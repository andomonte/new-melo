/**
 * Motor de recebimento do Caixa (Fase 1) — porte de GERAL.CAIXA.INCLUIR_RECEBIMENTO
 * (+ INC_CONTASFR, INCLUIR_CARTAO, COBRANCA_CARTAO_INCLUIR, COBRANCA_INCLUIR).
 *
 * Escopo v1: UM título, formas dinheiro / PIX / cartão (à vista e parcelado).
 * NÃO gerencia a transação — o chamador faz BEGIN/COMMIT (API) ou BEGIN/ROLLBACK (teste).
 *
 * Por pagamento: grava movimento dbfreceb (+reduz débito do cliente); se cartão,
 * grava FIN_CARTAO (líquido) e cria N títulos dbreceb a receber da operadora
 * (venc por dbopera.Pzopera). No fim, baixa o título original.
 */

import type { PoolClient } from 'pg';

export type FormaPagamento =
  | 'dinheiro'
  | 'pix'
  | 'credito'
  | 'debito'
  | 'deposito'
  | 'credito_devolucao';

export interface PagamentoInput {
  forma: FormaPagamento; // grupo de comportamento (juros/tarifa/cartão)
  valor: number;
  tipo?: string; // código real da forma (dbforma_pagto.codfpgt) → dbfreceb.tipo do principal
  codopera?: string; // cartão
  vezes?: number; // cartão (nº de parcelas)
  cvnsu?: string; // cartão CV/NSU
  autorizacao?: string; // cartão autorização
  cof_id?: number | string | null; // conta financeira escolhida (cad_conta_financeira.cof_id)
}

export interface ReceberParams {
  cod_receb: string;
  dataPgto: string; // 'YYYY-MM-DD'
  cod_conta: string; // conta financeira do operador
  username: string;
  juros?: number; // juros amortizado (0 se em dia) — sempre integral (regra Delphi)
  /** tarifa bancária do título (de dados-recebimento). Gravada como movimento tarifa (conta 161). */
  tarifa?: number;
  /** principal pendente (de dados-recebimento). Se os pagamentos cobrirem menos → parcial (rec='N'). */
  principalPendente?: number;
  pagamentos: PagamentoInput[];
}

export interface ReceberResultado {
  cod_receb: string;
  movimentos: { cod_freceb: string; tipo: string; valor: number }[];
  titulosCartao: { cod_receb: string; parcela: string; valor: number; dt_venc: string; nro_doc: string }[];
  finCartao: { car_id: string; valor: number; vlrliq: number }[];
  baixa: { valor_rec: number; rec: string; principalRecebido: number; parcial: boolean };
}

// DBFORMA_PAGTO: código do movimento (dbfreceb.tipo)
const TIPO_PRINCIPAL: Record<FormaPagamento, string> = {
  dinheiro: '01',
  pix: '42',
  credito: '04',
  debito: '04',
  deposito: '09',
  credito_devolucao: '05',
};
// Tipo do movimento de juros por forma primária
const TIPO_JUROS: Record<FormaPagamento, string> = {
  dinheiro: '18',
  pix: '43',
  credito: '23',
  debito: '23',
  deposito: '18',
  credito_devolucao: '18',
};
// Tipo do movimento de TARIFA por forma primária (Delphi: 06 din / 07 cheque / 08 cartão / 44 pix)
const TIPO_TARIFA: Record<FormaPagamento, string> = {
  dinheiro: '06',
  pix: '44',
  credito: '08',
  debito: '08',
  deposito: '06',
  credito_devolucao: '06',
};
// Tarifas (não reduzem débito do cliente / não somam no título)
const TIPOS_TARIFA = new Set(['06', '07', '08', '15', '32', '44']);

// Contas financeiras fixas do recebimento (regra Delphi): tarifa→161, juros→160.
const COF_TARIFA = 161;
const COF_JUROS = 160;

// Contas bloqueadas para recebimento — porte da lista hardcoded do SysCaixa (bbtnSalvarClick).
// São contas de operadores desativados. TODO: mover para um flag em dbconta/config no futuro.
export const CONTAS_BLOQUEADAS = new Set([
  112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 125, 126, 127, 128, 129, 130, 131, 132,
  135, 136, 137, 138, 139, 143, 144, 145, 146, 148, 149, 151, 152, 153, 154, 155, 159, 161, 162, 163,
  164, 165, 166, 167, 170, 171, 172, 173, 174, 176, 177, 178,
]);

/** Valida a conta do operador: precisa existir em dbconta e não estar bloqueada (regra Delphi). */
async function validarContaOperador(c: PoolClient, codConta: string): Promise<void> {
  const cod = String(codConta || '').trim();
  if (!cod) throw new Error('Informe a conta do operador.');
  const r = await c.query('SELECT nro_conta FROM dbconta WHERE cod_conta=$1', [cod.padStart(4, '0')]);
  if (r.rows.length === 0) throw new Error(`Conta do operador "${cod}" inválida.`);
  if (CONTAS_BLOQUEADAS.has(Number(cod))) {
    throw new Error(`Conta "${cod}" (${r.rows[0].nro_conta}) bloqueada para recebimento.`);
  }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lpad = (n: number | string, len: number) => String(n).padStart(len, '0');

/** Próximo cod_receb global (9 dígitos) — MAX+1 via índice da PK (dígitos fixos). */
async function proximoCodReceb(c: PoolClient): Promise<string> {
  const r = await c.query(
    "SELECT cod_receb FROM dbreceb WHERE cod_receb ~ '^[0-9]{9}$' ORDER BY cod_receb DESC LIMIT 1",
  );
  // cod_receb tem 9 dígitos (máx 999.999.999 < Number.MAX_SAFE_INTEGER) — Number é seguro.
  const max = r.rows[0] ? Number(r.rows[0].cod_receb) : 0;
  return lpad(String(max + 1), 9);
}

/** Próximo cod_freceb de um título (3 dígitos). */
async function proximoCodFreceb(c: PoolClient, codReceb: string): Promise<string> {
  const r = await c.query(
    'SELECT COALESCE(MAX(cod_freceb::int),0)+1 AS n FROM dbfreceb WHERE cod_receb=$1',
    [codReceb],
  );
  return lpad(r.rows[0].n, 3);
}

/** Próximo car_id de FIN_CARTAO. */
async function proximoCarId(c: PoolClient): Promise<string> {
  const r = await c.query('SELECT COALESCE(MAX(car_id::bigint),0)+1 AS n FROM fin_cartao');
  return String(r.rows[0].n);
}

async function reduzDebitoCliente(c: PoolClient, codcli: string, valor: number) {
  if (!codcli) return;
  await c.query('UPDATE dbclien SET debito = COALESCE(debito,0) - $1 WHERE codcli=$2', [valor, codcli]);
}
async function adicionaDebitoCliente(c: PoolClient, codcli: string, valor: number) {
  if (!codcli) return;
  await c.query('UPDATE dbclien SET debito = COALESCE(debito,0) + $1 WHERE codcli=$2', [valor, codcli]);
}

/** Insere um movimento em dbfreceb (porte de INC_CONTASFR) e reduz o débito do cliente. */
async function incContasFr(
  c: PoolClient,
  args: {
    codReceb: string;
    codcliOriginal: string;
    codopera?: string | null;
    valor: number;
    tipo: string;
    sf: string;
    dataPgto: string;
    txCartao?: number | null;
    dtCartao?: string | null;
    codConta: string; // conta do OPERADOR (caixa)
    contaFinanceira?: number | string | null; // cof_id (classificação): fre_cof_id
    codusr: string | null;
    coddocumento?: string | null;
    codautorizacao?: string | null;
    parcela?: string | null;
    nome: string;
  },
): Promise<string> {
  const codFreceb = await proximoCodFreceb(c, args.codReceb);
  const cofId = args.contaFinanceira != null && String(args.contaFinanceira).trim() !== ''
    ? Number(args.contaFinanceira)
    : null;
  await c.query(
    `INSERT INTO dbfreceb
       (cod_freceb, cod_receb, codopera, dt_cartao, tx_cartao, nome, valor, tipo, sf,
        dt_pgto, dt_venc, dt_emissao, fre_cof_id, codusr, cod_conta, parcela, coddocumento, codautorizacao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$10,$11,$12,$13,$14,$15,$16)`,
    [
      codFreceb, args.codReceb, args.codopera || null, args.dtCartao || null, args.txCartao ?? null,
      args.nome, args.valor, args.tipo, args.sf, args.dataPgto, cofId, args.codusr,
      args.codConta, args.parcela || null, args.coddocumento || null, args.codautorizacao || null,
    ],
  );
  // Red_Debcli: reduz débito do cliente, exceto tarifas
  if (!TIPOS_TARIFA.has(args.tipo)) {
    await reduzDebitoCliente(c, args.codcliOriginal, args.valor);
  }
  return codFreceb;
}

/**
 * Cria as N parcelas a receber da operadora (porte de COBRANCA_CARTAO_INCLUIR + COBRANCA_INCLUIR).
 * Registra também FIN_CARTAO e fin_cartao_receb, e soma o débito da operadora.
 */
async function incluirCartao(
  c: PoolClient,
  args: {
    pag: PagamentoInput;
    dataPgto: string;
    codusr: string | null;
    uname: string;
    resultado: ReceberResultado;
  },
) {
  const { pag, dataPgto } = args;
  const opRes = await c.query(
    'SELECT txopera, pzopera, codcli FROM dbopera WHERE codopera=$1',
    [pag.codopera],
  );
  if (opRes.rows.length === 0) throw new Error(`Operadora ${pag.codopera} não encontrada`);
  const { txopera, pzopera, codcli: codcliOpera } = opRes.rows[0];
  const n = Math.max(1, Number(pag.vezes || 1));
  const vlrliq = r2(pag.valor * (1 - Number(txopera) / 100));

  // FIN_CARTAO
  const carId = await proximoCarId(c);
  await c.query(
    `INSERT INTO fin_cartao
       (car_id, car_codcli, car_valor, car_vlrliq, car_nrodocumento, car_nroautorizacao, car_nroparcela, car_data, car_codoperadora)
     VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE, $8)`,
    [carId, codcliOpera, pag.valor, vlrliq, pag.cvnsu || null, pag.autorizacao || null, lpad(n, 2), pag.codopera],
  );
  args.resultado.finCartao.push({ car_id: carId, valor: pag.valor, vlrliq });

  // Parcelas
  const vlrParcela = r2(vlrliq / n);
  const vlrPrimeira = r2(vlrliq - vlrParcela * (n - 1));
  for (let i = 1; i <= n; i++) {
    const parcelaValor = i === 1 ? vlrPrimeira : vlrParcela;
    const dtVencRes = await c.query(
      "SELECT to_char($1::date + ($2::int * $3::int), 'YYYY-MM-DD') AS dt",
      [dataPgto, i, pzopera],
    );
    const dtVenc = dtVencRes.rows[0].dt;
    const novoCodReceb = await proximoCodReceb(c);
    const nroDoc = `C${pag.cvnsu || ''}-${lpad(i, 2)}`;
    await c.query(
      `INSERT INTO dbreceb
         (cod_receb, nro_doc, cod_conta, cod_fat, cod_venda, codcli, valor_pgto, valor_rec,
          dt_venc, dt_pgto, dt_emissao, tipo, rec, cancel, forma_fat, nrocx, venc_ant,
          bradesco, nro_banco, banco, codgp, dtvenc_previsao, rec_cof_id)
       VALUES ($1,$2,'0102',NULL,NULL,$3,$4,0, $5,NULL,$6,'F','N','N','6','1',$5,
               'N',NULL,'9',NULL,$5,261)`,
      [novoCodReceb, nroDoc, codcliOpera, parcelaValor, dtVenc, dataPgto],
    );
    await c.query(
      "INSERT INTO dbprereceb (cod_receb, dt_pgto, valor_rec, rec, cod_conta) VALUES ($1,NULL,0,'N','0102')",
      [novoCodReceb],
    );
    // link com a transação de cartão
    await c.query(
      'INSERT INTO fin_cartao_receb (car_car_id, car_cod_receb, car_parcela) VALUES ($1,$2,$3)',
      [carId, novoCodReceb, i],
    );
    // débito da operadora
    await adicionaDebitoCliente(c, codcliOpera, parcelaValor);
    args.resultado.titulosCartao.push({ cod_receb: novoCodReceb, parcela: `${i}/${n}`, valor: parcelaValor, dt_venc: dtVenc, nro_doc: nroDoc });
  }
}

/** Registra o juros recebido em FIN_RECEB_CONTROLE_JUROS (porte de CONTROLAR_JUROS). */
async function controlarJuros(c: PoolClient, codReceb: string, data: string, jurosDevido: number, jurosRecebido: number) {
  const ex = await c.query(
    'SELECT 1 FROM fin_receb_controle_juros WHERE rcj_cod_receb=$1 AND rcj_data=$2',
    [codReceb, data],
  );
  if (ex.rows.length > 0) {
    await c.query(
      'UPDATE fin_receb_controle_juros SET rcj_juros_recebido = rcj_juros_recebido + $1 WHERE rcj_cod_receb=$2 AND rcj_data=$3',
      [jurosRecebido, codReceb, data],
    );
  } else {
    await c.query(
      'INSERT INTO fin_receb_controle_juros (rcj_cod_receb, rcj_data, rcj_juros, rcj_juros_recebido) VALUES ($1,$2,$3,$4)',
      [codReceb, data, jurosDevido, jurosRecebido],
    );
  }
}

/**
 * Executa o recebimento de UM título. O chamador controla a transação.
 */
export async function executarRecebimento(
  c: PoolClient,
  p: ReceberParams,
  opts: { gerarFinCartao?: boolean } = {},
): Promise<ReceberResultado> {
  if (!p.pagamentos?.length) throw new Error('Informe ao menos uma forma de pagamento.');

  // Trava: conta do operador válida e não bloqueada (regra Delphi).
  await validarContaOperador(c, p.cod_conta);

  // Título (trava)
  const tRes = await c.query(
    'SELECT cod_receb, codcli, valor_pgto, valor_rec, rec, cancel FROM dbreceb WHERE cod_receb=$1 FOR UPDATE',
    [p.cod_receb],
  );
  if (tRes.rows.length === 0) throw new Error('Título não encontrado.');
  const titulo = tRes.rows[0];
  if (titulo.cancel === 'S') throw new Error('Título cancelado.');
  if (titulo.rec === 'S') throw new Error('Título já recebido.');

  const codcliOriginal = titulo.codcli;
  const userRes = await c.query('SELECT codusr FROM dbusuario WHERE nomeusr=$1 LIMIT 1', [p.username]);
  const codusr: string | null = userRes.rows[0]?.codusr ?? null;

  const resultado: ReceberResultado = {
    cod_receb: p.cod_receb,
    movimentos: [],
    titulosCartao: [],
    finCartao: [],
    baixa: { valor_rec: 0, rec: 'N', principalRecebido: 0, parcial: false },
  };

  // Trava (antes de gravar): o principal recebido não pode exceder o pendente (over-payment/troco não tratado).
  const somaPrincipal = p.pagamentos.reduce((s, pg) => s + Number(pg.valor || 0), 0);
  if (p.principalPendente != null && somaPrincipal > Number(p.principalPendente) + 0.01) {
    throw new Error(
      `Valor recebido (${somaPrincipal.toFixed(2)}) excede o principal pendente (${Number(
        p.principalPendente,
      ).toFixed(2)}).`,
    );
  }

  // 1) Juros amortizado (se houver) — movimento próprio + controle
  const juros = Number(p.juros || 0);
  if (juros > 0) {
    const forma0 = p.pagamentos[0].forma;
    const tipoJ = TIPO_JUROS[forma0];
    const codF = await incContasFr(c, {
      codReceb: p.cod_receb, codcliOriginal, valor: juros, tipo: tipoJ, sf: 'S',
      dataPgto: p.dataPgto, codConta: p.cod_conta, contaFinanceira: COF_JUROS, codusr, nome: 'JUROS',
    });
    await controlarJuros(c, p.cod_receb, p.dataPgto, juros, juros);
    resultado.movimentos.push({ cod_freceb: codF, tipo: tipoJ, valor: juros });
  }

  // 2) Pagamentos (principal)
  let principalRecebido = 0;
  for (const pag of p.pagamentos) {
    const ehCartao = pag.forma === 'credito' || pag.forma === 'debito';
    // tipo real da forma (codfpgt da dbforma_pagto); fallback pelo grupo de comportamento.
    const tipo = (pag.tipo && String(pag.tipo).trim()) || TIPO_PRINCIPAL[pag.forma];
    let txCartao: number | null = null;
    let dtCartao: string | null = null;
    if (ehCartao) {
      const op = await c.query('SELECT txopera, pzopera FROM dbopera WHERE codopera=$1', [pag.codopera]);
      if (op.rows.length === 0) throw new Error(`Operadora ${pag.codopera} não encontrada`);
      txCartao = Number(op.rows[0].txopera);
      const dtc = await c.query("SELECT to_char($1::date + $2::int,'YYYY-MM-DD') dt", [p.dataPgto, op.rows[0].pzopera]);
      dtCartao = dtc.rows[0].dt;
    }
    const codF = await incContasFr(c, {
      codReceb: p.cod_receb, codcliOriginal, codopera: ehCartao ? pag.codopera : null,
      valor: pag.valor, tipo, sf: ehCartao ? 'N' : 'S', dataPgto: p.dataPgto,
      txCartao, dtCartao, codConta: p.cod_conta, contaFinanceira: pag.cof_id ?? null, codusr,
      coddocumento: ehCartao ? pag.cvnsu : null, codautorizacao: ehCartao ? pag.autorizacao : null,
      parcela: ehCartao ? String(pag.vezes || 1) : null, nome: `Recebimento ${pag.forma}`,
    });
    resultado.movimentos.push({ cod_freceb: codF, tipo, valor: pag.valor });

    // FIN_CARTAO/parcelas: no fluxo multi, geradas UMA vez à parte (gerarFinCartao=false) para
    // não duplicar quando um cartão é dividido entre títulos.
    if (ehCartao && opts.gerarFinCartao !== false) {
      await incluirCartao(c, { pag, dataPgto: p.dataPgto, codusr, uname: p.username, resultado });
    }
    principalRecebido += pag.valor;
  }

  // 2b) Tarifa bancária do título (regra Delphi): lançamento separado tipo 06/07/08/44,
  // conta financeira 161 (TARIFA). Não reduz o débito do cliente (TIPOS_TARIFA).
  const tarifa = Number(p.tarifa || 0);
  if (tarifa > 0) {
    const forma0 = p.pagamentos[0].forma;
    const tipoT = TIPO_TARIFA[forma0];
    const codFt = await incContasFr(c, {
      codReceb: p.cod_receb, codcliOriginal, valor: tarifa, tipo: tipoT, sf: 'S',
      dataPgto: p.dataPgto, codConta: p.cod_conta, contaFinanceira: COF_TARIFA, codusr, nome: 'TARIFA',
    });
    resultado.movimentos.push({ cod_freceb: codFt, tipo: tipoT, valor: tarifa });
  }

  // 3) Baixa do título original
  // valor_rec acumula principal + juros (paridade Oracle: JUROS_RECEBIDO depois desconta o juros
  // p/ achar o principal). rec='S' só quando o PRINCIPAL é totalmente coberto — senão parcial ('N').
  const jurosPago = juros > 0 ? juros : 0;
  const novoValorRec = r2(Number(titulo.valor_rec || 0) + principalRecebido + jurosPago);
  const principalAlvo =
    p.principalPendente != null
      ? Number(p.principalPendente)
      : Math.max(0, Number(titulo.valor_pgto || 0) - Number(titulo.valor_rec || 0));
  const rec = principalRecebido >= principalAlvo - 0.005 ? 'S' : 'N';
  await c.query(
    'UPDATE dbreceb SET valor_rec=$1, rec=$2, dt_pgto=$3, cod_conta=$4 WHERE cod_receb=$5',
    [novoValorRec, rec, p.dataPgto, p.cod_conta, p.cod_receb],
  );
  resultado.baixa = {
    valor_rec: novoValorRec,
    rec,
    principalRecebido: r2(principalRecebido),
    parcial: rec === 'N',
  };

  return resultado;
}

// ===================== MULTI-TÍTULO (waterfall) =====================

export interface TituloReceber {
  cod_receb: string;
  principalPendente: number;
  juros: number;
  tarifa?: number;
}

export interface ReceberMultiParams {
  titulos: TituloReceber[]; // na ordem de aplicação
  dataPgto: string;
  cod_conta: string;
  username: string;
  pagamentos: PagamentoInput[];
}

/**
 * Aloca os pagamentos (principal) entre os títulos em cascata (waterfall), na ordem dada —
 * porte da lógica de frmMain.receber. Um pagamento (inclusive cartão) pode ser dividido entre títulos.
 * Retorna, por título, a fatia de pagamentos que lhe cabe (títulos não tocados ficam vazios).
 */
export function allocatePagamentos(
  titulos: TituloReceber[],
  pagamentos: PagamentoInput[],
): { titulo: TituloReceber; pagamentos: PagamentoInput[] }[] {
  const buckets = pagamentos.map((p) => ({ pag: p, remaining: p.valor }));
  const out = titulos.map((t) => ({ titulo: t, pagamentos: [] as PagamentoInput[] }));
  let bi = 0;
  for (const slot of out) {
    let need = slot.titulo.principalPendente;
    while (need > 0.005 && bi < buckets.length) {
      const b = buckets[bi];
      if (b.remaining <= 0.005) {
        bi++;
        continue;
      }
      const take = r2(Math.min(b.remaining, need));
      slot.pagamentos.push({ ...b.pag, valor: take });
      b.remaining = r2(b.remaining - take);
      need = r2(need - take);
    }
  }
  return out;
}

/**
 * Recebe VÁRIOS títulos numa transação (o chamador controla BEGIN/COMMIT/ROLLBACK).
 * Cartão: gera FIN_CARTAO + parcelas da operadora UMA vez (valor total), à parte; a baixa é
 * distribuída entre os títulos em cascata (waterfall) — paridade com frmMain.receber.
 */
export async function executarRecebimentoMulti(
  c: PoolClient,
  params: ReceberMultiParams,
): Promise<ReceberResultado[]> {
  if (!params.titulos?.length) throw new Error('Informe ao menos um título.');

  // Trava (paridade Delphi): todos os títulos devem ser do MESMO cliente.
  if (params.titulos.length > 1) {
    const cli = await c.query(
      'SELECT DISTINCT codcli FROM dbreceb WHERE cod_receb = ANY($1)',
      [params.titulos.map((t) => t.cod_receb)],
    );
    if (cli.rows.length > 1) {
      throw new Error('Todos os títulos devem ser do mesmo cliente.');
    }
  }

  // Guarda: total pago não pode exceder o total do principal pendente (over-payment/troco não tratado).
  const totalPago = params.pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const totalPrincipal = params.titulos.reduce((s, t) => s + Number(t.principalPendente || 0), 0);
  if (totalPago > totalPrincipal + 0.01) {
    throw new Error(
      `Valor recebido (${totalPago.toFixed(2)}) excede o principal pendente dos títulos (${totalPrincipal.toFixed(2)}).`,
    );
  }

  const userRes = await c.query('SELECT codusr FROM dbusuario WHERE nomeusr=$1 LIMIT 1', [params.username]);
  const codusr: string | null = userRes.rows[0]?.codusr ?? null;

  // 1) FIN_CARTAO + parcelas da operadora: uma vez por cartão (valor total do cartão), à parte da baixa.
  const cardAgg: ReceberResultado = {
    cod_receb: '',
    movimentos: [],
    titulosCartao: [],
    finCartao: [],
    baixa: { valor_rec: 0, rec: 'N', principalRecebido: 0, parcial: false },
  };
  for (const card of params.pagamentos.filter((p) => p.forma === 'credito' || p.forma === 'debito')) {
    await incluirCartao(c, { pag: card, dataPgto: params.dataPgto, codusr, uname: params.username, resultado: cardAgg });
  }

  // 2) Baixa distribuída entre os títulos (sem gerar FIN_CARTAO de novo).
  const alloc = allocatePagamentos(params.titulos, params.pagamentos);
  const results: ReceberResultado[] = [];
  for (const slot of alloc) {
    if (slot.pagamentos.length === 0) continue; // título não recebeu nada
    const r = await executarRecebimento(
      c,
      {
        cod_receb: slot.titulo.cod_receb,
        dataPgto: params.dataPgto,
        cod_conta: params.cod_conta,
        username: params.username,
        juros: slot.titulo.juros,
        tarifa: slot.titulo.tarifa,
        principalPendente: slot.titulo.principalPendente,
        pagamentos: slot.pagamentos,
      },
      { gerarFinCartao: false },
    );
    results.push(r);
  }

  // Anexa as parcelas/FIN_CARTAO (geradas uma vez) ao 1º resultado, para exibição.
  if (results.length && (cardAgg.titulosCartao.length || cardAgg.finCartao.length)) {
    results[0].titulosCartao = cardAgg.titulosCartao;
    results[0].finCartao = cardAgg.finCartao;
  }
  return results;
}

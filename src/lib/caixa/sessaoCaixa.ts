/**
 * Serviço de ABERTURA/FECHAMENTO de caixa (sessão de recebimento).
 * Ver docs/caixa/spec-abertura-fechamento-caixa-melo.md.
 *
 * ADITIVO: opera só nas tabelas novas (caixa_sessao/movimento/fechamento_forma).
 * NÃO gerencia a transação — o chamador faz BEGIN/COMMIT (API) ou BEGIN/ROLLBACK (teste),
 * mesmo padrão de receber.ts.
 */

import type { PoolClient } from 'pg';
import { CONTAS_BLOQUEADAS } from './receber';
import {
  calcularSaldoDinheiro,
  totaisPorForma,
  calcularQuebra,
  sentidoPadrao,
  round2,
  type MovimentoSaldo,
  type FormaPagamento,
  type TipoMovimento,
  type Sentido,
} from './saldoSessao';

/** Erro de domínio com código estável (a API mapeia para HTTP). */
export class CaixaError extends Error {
  code: string;
  http: number;
  constructor(code: string, message: string, http = 422) {
    super(message);
    this.code = code;
    this.http = http;
    this.name = 'CaixaError';
  }
}

/** MANAUS → db_manaus, etc. Só os schemas ativos (mesmos da migration 033). */
const SCHEMA_POR_FILIAL: Record<string, string> = {
  MANAUS: 'db_manaus',
  RONDONIA: 'db_rondonia',
  RORAIMA: 'db_roraima',
};
export function schemaDaFilial(filial: string): string {
  const s = SCHEMA_POR_FILIAL[String(filial || '').trim().toUpperCase()];
  if (!s) throw new CaixaError('FILIAL_INVALIDA', `Filial "${filial}" sem caixa configurado.`);
  return s;
}

export type Status = 'ABERTO' | 'EM_FECHAMENTO' | 'FECHADO';

export interface Sessao {
  id: number;
  filial: string;
  cod_conta: string;
  operador_abertura: string;
  operador_fechamento: string | null;
  status: Status;
  aberto_em: string;
  fechado_em: string | null;
  fundo_troco: number;
  saldo_esperado_dinheiro: number | null;
  saldo_informado_dinheiro: number | null;
  quebra: number | null;
  fechamento_forcado: boolean;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

function mapSessao(row: any): Sessao {
  return {
    id: Number(row.id),
    filial: row.filial,
    cod_conta: row.cod_conta,
    operador_abertura: row.operador_abertura,
    operador_fechamento: row.operador_fechamento,
    status: row.status,
    aberto_em: row.aberto_em,
    fechado_em: row.fechado_em,
    fundo_troco: num(row.fundo_troco),
    saldo_esperado_dinheiro: row.saldo_esperado_dinheiro == null ? null : num(row.saldo_esperado_dinheiro),
    saldo_informado_dinheiro: row.saldo_informado_dinheiro == null ? null : num(row.saldo_informado_dinheiro),
    quebra: row.quebra == null ? null : num(row.quebra),
    fechamento_forcado: !!row.fechamento_forcado,
  };
}

/** Valida a conta: existe em dbconta do schema e não está bloqueada (regra Delphi). */
async function validarConta(c: PoolClient, schema: string, codConta: string): Promise<string> {
  const cod = String(codConta || '').trim();
  if (!cod) throw new CaixaError('VALOR_INVALIDO', 'Informe a conta do caixa.');
  const padded = cod.padStart(4, '0');
  const r = await c.query(`SELECT nro_conta FROM ${schema}.dbconta WHERE cod_conta=$1`, [padded]);
  if (r.rows.length === 0) throw new CaixaError('VALOR_INVALIDO', `Conta "${cod}" inválida.`, 422);
  if (CONTAS_BLOQUEADAS.has(Number(cod))) {
    throw new CaixaError('CONTA_BLOQUEADA', `Conta "${cod}" (${r.rows[0].nro_conta}) bloqueada.`, 422);
  }
  return padded;
}

/** Sessão ABERTO/EM_FECHAMENTO da conta, ou null. */
export async function sessaoAtual(
  c: PoolClient,
  schema: string,
  codConta: string,
): Promise<Sessao | null> {
  const r = await c.query(
    `SELECT * FROM ${schema}.caixa_sessao
     WHERE cod_conta=$1 AND status IN ('ABERTO','EM_FECHAMENTO')
     ORDER BY id DESC LIMIT 1`,
    [String(codConta).padStart(4, '0')],
  );
  return r.rows[0] ? mapSessao(r.rows[0]) : null;
}

export async function getSessao(c: PoolClient, schema: string, id: number): Promise<Sessao> {
  const r = await c.query(`SELECT * FROM ${schema}.caixa_sessao WHERE id=$1`, [id]);
  if (!r.rows[0]) throw new CaixaError('NAO_ENCONTRADA', `Sessão ${id} não encontrada.`, 404);
  return mapSessao(r.rows[0]);
}

// ---------------------------------------------------------------------------
// UC-01 — Abrir caixa
// ---------------------------------------------------------------------------
export interface AbrirParams {
  filial: string;
  cod_conta: string;
  operador: string;
  fundo_troco: number;
  observacao?: string;
}

export async function abrirCaixa(c: PoolClient, p: AbrirParams): Promise<Sessao> {
  const schema = schemaDaFilial(p.filial);
  const codConta = await validarConta(c, schema, p.cod_conta);
  const fundo = round2(num(p.fundo_troco));
  if (fundo < 0) throw new CaixaError('VALOR_INVALIDO', 'Fundo de troco não pode ser negativo.');

  const jaAberta = await sessaoAtual(c, schema, codConta);
  if (jaAberta) {
    throw new CaixaError('CAIXA_JA_ABERTO', `Já existe caixa aberto nesta conta (sessão ${jaAberta.id}).`, 409);
  }

  let ins;
  try {
    ins = await c.query(
      `INSERT INTO ${schema}.caixa_sessao
         (filial, cod_conta, operador_abertura, status, fundo_troco, observacao_abertura)
       VALUES ($1,$2,$3,'ABERTO',$4,$5) RETURNING *`,
      [p.filial, codConta, p.operador, fundo, p.observacao ?? null],
    );
  } catch (e: any) {
    // corrida: índice único parcial garante 1 sessão aberta por conta
    if (e?.code === '23505') {
      throw new CaixaError('CAIXA_JA_ABERTO', 'Já existe caixa aberto nesta conta.', 409);
    }
    throw e;
  }
  const sessao = mapSessao(ins.rows[0]);

  // fundo de troco > 0 → movimento de ABERTURA em dinheiro
  if (fundo > 0) {
    await inserirMovimento(c, schema, {
      sessao_id: sessao.id,
      tipo: 'ABERTURA',
      forma_pagamento: 'DINHEIRO',
      valor: fundo,
      operador: p.operador,
    });
  }
  return sessao;
}

// ---------------------------------------------------------------------------
// Movimentos
// ---------------------------------------------------------------------------
export interface MovimentoInput {
  sessao_id: number;
  tipo: TipoMovimento;
  forma_pagamento: FormaPagamento;
  valor: number;
  sentido?: Sentido;
  referencia?: string;
  motivo?: string;
  operador: string;
  idempotency_key?: string;
}

/** Inserção crua de movimento (sem validações de estado — usada internamente). */
async function inserirMovimento(c: PoolClient, schema: string, m: MovimentoInput) {
  const sentido = m.sentido ?? sentidoPadrao(m.tipo);
  // idempotência: se a chave já existe na sessão, retorna o movimento original
  if (m.idempotency_key) {
    const ex = await c.query(
      `SELECT * FROM ${schema}.caixa_movimento WHERE sessao_id=$1 AND idempotency_key=$2`,
      [m.sessao_id, m.idempotency_key],
    );
    if (ex.rows[0]) return ex.rows[0];
  }
  const r = await c.query(
    `INSERT INTO ${schema}.caixa_movimento
       (sessao_id, tipo, forma_pagamento, valor, sentido, referencia, motivo, operador, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      m.sessao_id,
      m.tipo,
      m.forma_pagamento,
      round2(num(m.valor)),
      sentido,
      m.referencia ?? null,
      m.motivo ?? null,
      m.operador,
      m.idempotency_key ?? null,
    ],
  );
  return r.rows[0];
}

async function movimentosDaSessao(c: PoolClient, schema: string, sessaoId: number): Promise<MovimentoSaldo[]> {
  const r = await c.query(
    `SELECT tipo, forma_pagamento, valor, sentido FROM ${schema}.caixa_movimento WHERE sessao_id=$1`,
    [sessaoId],
  );
  return r.rows.map((x) => ({
    tipo: x.tipo as TipoMovimento,
    forma_pagamento: x.forma_pagamento as FormaPagamento,
    valor: num(x.valor),
    sentido: x.sentido as Sentido,
  }));
}

export async function listarMovimentos(c: PoolClient, schema: string, sessaoId: number) {
  const r = await c.query(
    `SELECT id, tipo, forma_pagamento, valor, sentido, referencia, motivo, operador, criado_em
       FROM ${schema}.caixa_movimento WHERE sessao_id=$1 ORDER BY id`,
    [sessaoId],
  );
  return r.rows;
}

/** Saldo esperado em dinheiro + totais por forma (derivados dos movimentos). */
export async function calcularSaldos(c: PoolClient, schema: string, sessao: Sessao) {
  const movs = await movimentosDaSessao(c, schema, sessao.id);
  return {
    saldoDinheiro: calcularSaldoDinheiro(sessao.fundo_troco, movs),
    totaisPorForma: totaisPorForma(movs),
  };
}

// UC-02 sangria / UC-03 suprimento --------------------------------------------
export interface SangriaSuprimentoParams {
  sessao_id: number;
  filial: string;
  operador: string;
  valor: number;
  motivo: string;
  idempotency_key?: string;
}

async function movimentoManual(
  c: PoolClient,
  tipo: 'SANGRIA' | 'SUPRIMENTO',
  p: SangriaSuprimentoParams,
) {
  const schema = schemaDaFilial(p.filial);
  const valor = round2(num(p.valor));
  if (valor <= 0) throw new CaixaError('VALOR_INVALIDO', 'Valor deve ser positivo.');
  if (!String(p.motivo || '').trim()) throw new CaixaError('MOTIVO_OBRIGATORIO', 'Informe o motivo.');

  const sessao = await getSessao(c, schema, p.sessao_id);
  if (sessao.status !== 'ABERTO') {
    const code = sessao.status === 'EM_FECHAMENTO' ? 'CAIXA_EM_FECHAMENTO' : 'CAIXA_FECHADO';
    throw new CaixaError(code, `Sessão não está aberta (status ${sessao.status}).`, 409);
  }

  if (tipo === 'SANGRIA') {
    const { saldoDinheiro } = await calcularSaldos(c, schema, sessao);
    if (valor > saldoDinheiro) {
      throw new CaixaError(
        'SALDO_INSUFICIENTE',
        `Sangria (R$ ${valor.toFixed(2)}) maior que o dinheiro em caixa (R$ ${saldoDinheiro.toFixed(2)}).`,
      );
    }
  }

  return inserirMovimento(c, schema, {
    sessao_id: p.sessao_id,
    tipo,
    forma_pagamento: 'DINHEIRO',
    valor,
    sentido: tipo === 'SANGRIA' ? 'SAIDA' : 'ENTRADA',
    motivo: p.motivo,
    operador: p.operador,
    idempotency_key: p.idempotency_key,
  });
}

export const registrarSangria = (c: PoolClient, p: SangriaSuprimentoParams) =>
  movimentoManual(c, 'SANGRIA', p);
export const registrarSuprimento = (c: PoolClient, p: SangriaSuprimentoParams) =>
  movimentoManual(c, 'SUPRIMENTO', p);

// ---------------------------------------------------------------------------
// UC-05 — Iniciar fechamento (congela snapshot)
// ---------------------------------------------------------------------------
export async function iniciarFechamento(
  c: PoolClient,
  filial: string,
  sessaoId: number,
) {
  const schema = schemaDaFilial(filial);
  const sessao = await getSessao(c, schema, sessaoId);
  if (sessao.status !== 'ABERTO') {
    throw new CaixaError('CAIXA_FECHADO', `Sessão não está aberta (status ${sessao.status}).`, 409);
  }
  const { saldoDinheiro, totaisPorForma: totais } = await calcularSaldos(c, schema, sessao);

  await c.query(
    `UPDATE ${schema}.caixa_sessao
       SET status='EM_FECHAMENTO', saldo_esperado_dinheiro=$2, updated_at=now()
     WHERE id=$1`,
    [sessaoId, saldoDinheiro],
  );

  // grava esperado por forma (exceto DINHEIRO, que é conferido pelo saldo da gaveta)
  await c.query(`DELETE FROM ${schema}.caixa_fechamento_forma WHERE sessao_id=$1`, [sessaoId]);
  for (const t of totais) {
    if (t.forma_pagamento === 'DINHEIRO') continue;
    await c.query(
      `INSERT INTO ${schema}.caixa_fechamento_forma (sessao_id, forma_pagamento, valor_esperado)
       VALUES ($1,$2,$3)`,
      [sessaoId, t.forma_pagamento, t.liquido],
    );
  }
  return { saldoEsperadoDinheiro: saldoDinheiro, esperadoPorForma: totais.filter((t) => t.forma_pagamento !== 'DINHEIRO') };
}

// ---------------------------------------------------------------------------
// UC-06 — Confirmar fechamento
// ---------------------------------------------------------------------------
export interface ConfirmarFechamentoParams {
  filial: string;
  sessao_id: number;
  operador: string;
  saldo_informado_dinheiro: number;
  valores_por_forma?: { forma_pagamento: FormaPagamento; valor_informado: number }[];
  observacao?: string;
}

export async function confirmarFechamento(c: PoolClient, p: ConfirmarFechamentoParams) {
  const schema = schemaDaFilial(p.filial);
  const sessao = await getSessao(c, schema, p.sessao_id);
  if (sessao.status !== 'EM_FECHAMENTO') {
    throw new CaixaError('CAIXA_FECHADO', `Sessão não está em fechamento (status ${sessao.status}).`, 409);
  }
  const informado = round2(num(p.saldo_informado_dinheiro));
  if (informado < 0) throw new CaixaError('VALOR_INVALIDO', 'Saldo informado não pode ser negativo.');

  const esperado = num(sessao.saldo_esperado_dinheiro);
  const quebra = calcularQuebra(informado, esperado);

  // preenche informado/diferença por forma
  for (const v of p.valores_por_forma ?? []) {
    await c.query(
      `UPDATE ${schema}.caixa_fechamento_forma
         SET valor_informado=$3, diferenca=round($3 - valor_esperado, 2)
       WHERE sessao_id=$1 AND forma_pagamento=$2`,
      [p.sessao_id, v.forma_pagamento, round2(num(v.valor_informado))],
    );
  }

  const upd = await c.query(
    `UPDATE ${schema}.caixa_sessao
       SET status='FECHADO', fechado_em=now(), operador_fechamento=$2,
           saldo_informado_dinheiro=$3, quebra=$4, observacao_fechamento=$5, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [p.sessao_id, p.operador, informado, quebra, p.observacao ?? null],
  );
  return { sessao: mapSessao(upd.rows[0]), quebra };
}

// UC-07 — Cancelar fechamento (volta para ABERTO)
export async function cancelarFechamento(c: PoolClient, filial: string, sessaoId: number) {
  const schema = schemaDaFilial(filial);
  const sessao = await getSessao(c, schema, sessaoId);
  if (sessao.status !== 'EM_FECHAMENTO') {
    throw new CaixaError('CAIXA_FECHADO', `Sessão não está em fechamento (status ${sessao.status}).`, 409);
  }
  await c.query(`DELETE FROM ${schema}.caixa_fechamento_forma WHERE sessao_id=$1`, [sessaoId]);
  const upd = await c.query(
    `UPDATE ${schema}.caixa_sessao
       SET status='ABERTO', saldo_esperado_dinheiro=NULL, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [sessaoId],
  );
  return mapSessao(upd.rows[0]);
}

/**
 * Gancho para o recebimento (UC-04) — registra movimento(s) RECEBIMENTO na sessão
 * aberta da conta. NÃO aplica o gate por padrão (exigirCaixaAberto=false), então o
 * fluxo atual do Caixa continua funcionando sem abertura. Quando não há sessão aberta
 * e exigirCaixaAberto=true → CaixaError CAIXA_FECHADO.
 * Retorna a sessão usada (ou null se não havia e o gate está desligado).
 */
export interface RecebimentoMovimento {
  forma_pagamento: FormaPagamento;
  valor: number;
  referencia?: string;
}
export async function registrarRecebimentoNaSessao(
  c: PoolClient,
  opts: {
    filial: string;
    cod_conta: string;
    operador: string;
    movimentos: RecebimentoMovimento[];
    exigirCaixaAberto?: boolean;
    idempotency_key?: string;
  },
): Promise<Sessao | null> {
  const schema = schemaDaFilial(opts.filial);
  const sessao = await sessaoAtual(c, schema, opts.cod_conta);
  if (!sessao || sessao.status !== 'ABERTO') {
    if (opts.exigirCaixaAberto) {
      throw new CaixaError('CAIXA_FECHADO', 'Recebimento exige caixa aberto nesta conta.', 409);
    }
    return null; // gate desligado: não amarra à sessão, fluxo atual segue
  }
  let i = 0;
  for (const m of opts.movimentos) {
    if (round2(num(m.valor)) <= 0) continue;
    await inserirMovimento(c, schema, {
      sessao_id: sessao.id,
      tipo: 'RECEBIMENTO',
      forma_pagamento: m.forma_pagamento,
      valor: m.valor,
      sentido: 'ENTRADA',
      referencia: m.referencia,
      operador: opts.operador,
      idempotency_key: opts.idempotency_key ? `${opts.idempotency_key}:${i}` : undefined,
    });
    i++;
  }
  return sessao;
}

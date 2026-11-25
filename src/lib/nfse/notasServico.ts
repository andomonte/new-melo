/**
 * Notas Fiscais de Serviço PRESTADAS — regras da etapa 2 (lançar, gerar títulos, cancelar),
 * fiéis ao Delphi (package Oracle COBRANCA_NF_SERVICO + PRETCOBRANCA, tipo 'S').
 *
 * Valores (conferido em 224 notas do histórico):
 *   base do ISS   = serviço − desconto − deduções
 *   ISS           = base × alíquota  (sempre calculado; só entra nas retenções se RETIDO)
 *   retenções     = ISS (se retido) + PIS + COFINS + IR + INSS + CSLL + outras
 *   valor líquido = serviço − desconto − retenções   → totalnfs = totalfat = líquido = soma dos títulos
 * Títulos (dbreceb tipo 'S', cod_fat = codfat):
 *   parcelas iguais, a 1ª absorve o arredondamento (CALCULAR_PARCELAS_NFS);
 *   documento 'S' + nº da nota (8) + letra A,B,C… (sem K, como no Delphi);
 *   emissão = data do lançamento; vencimento = lançamento + prazo (dias);
 *   banco/forma/conta pela regra INFORMACAO_FINANCEIRA (fatura oficial, tipofat '1').
 * Só servidor; usar dentro de BEGIN…COMMIT.
 */
import { bancoInternoDbreceb } from '@/lib/faturamento/bancoCobranca';
import { LEN_NRO_BANCO, proximoNroBanco } from '@/lib/boleto/nossoNumero';

export interface Consultavel {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;

export class NfsValidacaoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'NfsValidacaoError'; }
}

// ------------------------------------------------------------------ valores
// cálculo em calculoNota.ts (também usado pela tela)
import { calcularValoresNota, dividirParcelas, type EntradaValores } from './calculoNota';
export { calcularValoresNota, dividirParcelas };
export type { EntradaValores, ValoresCalculados } from './calculoNota';

// ------------------------------------------------------------------ cobrança (regra do Delphi)

/** Formas de cobrança da tela (MELO = cobrança própria; os bancos são boleto). */
export const FORMAS_MELO = ['CARTEIRA', 'CARTAO', 'PROMISSORIA', 'RECIBO'] as const;

interface InfoFinanceira { formaFat: string; codConta: string; bancoInterno: string }

/**
 * PRETCOBRANCA.INFORMACAO_FINANCEIRA (tipofat '1' = oficial, sempre na NFS-e).
 * `banco` = código do dropdown dbbanco_cobranca (1..9; 5 = MELO).
 */
export function informacaoFinanceira(banco: string | number, forma?: string | null): InfoFinanceira {
  const b = String(parseInt(String(banco), 10));
  const interno = bancoInternoDbreceb(b);
  if (!interno) throw new NfsValidacaoError('Banco de cobrança inválido.');
  // contas dos bancos (boleto, forma 2)
  const CONTA_BANCO: Record<string, string> = {
    '1': '0003', // BRADESCO
    '2': '0007', // BANCO DO BRASIL
    '3': '0104', // ITAU
    '4': '0124', // RURAL
    '6': '0208', // SANTANDER
    '7': '0141', // SAFRA
    '8': '0158', // CITIBANK
    '9': '0168', // CAIXA
  };
  if (b !== '5') return { formaFat: '2', codConta: CONTA_BANCO[b], bancoInterno: interno };
  switch (String(forma || '').toUpperCase()) {
    case 'CARTEIRA': return { formaFat: '4', codConta: '0005', bancoInterno: interno };
    case 'CARTAO': return { formaFat: '6', codConta: '0100', bancoInterno: interno };
    case 'PROMISSORIA': return { formaFat: '3', codConta: '0002', bancoInterno: interno };
    default: return { formaFat: '1', codConta: '0110', bancoInterno: interno }; // RECIBO e demais
  }
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P'];

const somarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
};

export interface OpcoesCobranca {
  banco: string | number;     // dbbanco_cobranca (1..9)
  forma?: string | null;      // CARTEIRA | CARTAO | PROMISSORIA | RECIBO (só MELO)
  prazos: number[];           // dias a partir do lançamento (ex.: [30, 60, 90]); [0] = à vista
}

/** Gera os títulos a receber da nota (dbreceb tipo 'S'). Recusa se já houver títulos ativos. */
export async function gerarTitulosNfs(db: Consultavel, codfat: string, op: OpcoesCobranca) {
  const nota = (await db.query(
    `SELECT codfat, nroform, codcli, totalfat, cancel, data::text AS data FROM nfs_nota WHERE codfat = $1 FOR UPDATE`,
    [codfat])).rows[0];
  if (!nota) throw new NfsValidacaoError('Nota não encontrada.');
  if (nota.cancel === 'S') throw new NfsValidacaoError('Nota cancelada.');
  const ja = (await db.query(
    `SELECT count(*)::int n FROM dbreceb WHERE tipo = 'S' AND cod_fat = $1 AND COALESCE(cancel,'N') <> 'S'`,
    [codfat])).rows[0].n;
  if (ja > 0) throw new NfsValidacaoError('Esta nota já tem títulos gerados.');

  const prazos = (op.prazos || []).map((p) => Math.round(Number(p))).filter((p) => p >= 0);
  if (!prazos.length) throw new NfsValidacaoError('Informe ao menos um prazo (em dias).');
  if (prazos.length > LETRAS.length) throw new NfsValidacaoError(`No máximo ${LETRAS.length} parcelas.`);
  const total = r2(nota.totalfat);
  if (total <= 0) throw new NfsValidacaoError('A nota não tem valor a receber (líquido zero).');

  const info = informacaoFinanceira(op.banco, op.forma);
  const ehBoleto = info.formaFat === '2' && !!LEN_NRO_BANCO[info.bancoInterno];
  const emissao = nota.data || new Date().toISOString().slice(0, 10);
  const numero = String(nota.nroform || nota.codfat).replace(/\D/g, '').padStart(8, '0').slice(-8);
  const valores = dividirParcelas(total, prazos.length);

  // sequence do cod_receb atrás do MAX (artefato da migração) — mesma correção do faturamento
  await db.query(
    `SELECT setval('seq_cod_receb', GREATEST((SELECT last_value FROM seq_cod_receb),
       (SELECT COALESCE(MAX(cod_receb::bigint), 0) FROM dbreceb WHERE cod_receb ~ '^[0-9]+$')), true)`);

  const titulos: { cod_receb: string; nro_doc: string; vencimento: string; valor: number }[] = [];
  for (let i = 0; i < prazos.length; i++) {
    const cod = String((await db.query(`SELECT nextval('seq_cod_receb') AS n`)).rows[0].n).padStart(9, '0');
    const venc = somarDias(emissao, prazos[i]);
    const doc = `S${numero}${LETRAS[i]}`;
    const nroBanco = ehBoleto ? await proximoNroBanco(db, info.bancoInterno) : null;
    await db.query(
      `INSERT INTO dbreceb (cod_receb, codcli, cod_fat, cod_conta, dt_venc, dt_emissao, valor_pgto, valor_rec,
                            nro_doc, forma_fat, banco, nro_banco, tipo, rec, cancel, bradesco, venc_ant, dtvenc_previsao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,'S','N','N','N',$5,$5)`,
      [cod, nota.codcli, codfat, info.codConta, venc, emissao, valores[i], doc, info.formaFat, info.bancoInterno, nroBanco]);
    titulos.push({ cod_receb: cod, nro_doc: doc, vencimento: venc, valor: valores[i] });
  }
  await db.query(`UPDATE nfs_nota SET frmfat = $2, cod_conta = $3, atualizado_em = now() WHERE codfat = $1`,
    [codfat, info.formaFat, info.codConta]);
  return { titulos, formaFat: info.formaFat, codConta: info.codConta };
}

// ------------------------------------------------------------------ lançamento

export interface EntradaNota extends EntradaValores {
  codcli: string;
  nroform: string;
  verificacao?: string | null; // código de verificação (NFS-e da prefeitura, até 2025)
  chave_acesso?: string | null; // chave de acesso de 50 dígitos (NFS-e nacional, 2026+)
  dtemissao: string;          // yyyy-mm-dd
  competencia: string;        // MM/AAAA
  sen_id: string;             // dbservico_nfs
  descr: string;              // discriminação do serviço
  obs?: string | null;
  cst_pis?: string | null;
  cst_cofins?: string | null;
}

const texto = (v: any, max: number) => {
  const t = v == null ? '' : String(v).trim();
  return t ? t.slice(0, max) : null;
};

/** Lança a nota (e o serviço). Devolve o codfat. Valida duplicidade como o Delphi (nº + verificação). */
export async function lancarNotaServico(
  db: Consultavel, e: EntradaNota, codusr?: string | null,
  extra: { origem?: 'WEB' | 'NACIONAL'; xml?: string | null } = {},
) {
  const nroform = texto(e.nroform, 15);
  const verificacao = texto(e.verificacao, 50);
  const chave = String(e.chave_acesso || '').replace(/\D/g, '') || null;
  if (!e.codcli) throw new NfsValidacaoError('Informe o cliente (tomador).');
  if (!nroform) throw new NfsValidacaoError('Informe o número da nota.');
  if (chave && chave.length !== 50) throw new NfsValidacaoError('A chave de acesso da NFS-e nacional tem 50 dígitos.');
  if (!verificacao && !chave) throw new NfsValidacaoError('Informe a chave de acesso (nota nacional) ou o código de verificação (nota da prefeitura).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.dtemissao || ''))) throw new NfsValidacaoError('Informe a data de emissão.');
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(String(e.competencia || ''))) throw new NfsValidacaoError('Competência no formato MM/AAAA.');
  if (!e.sen_id) throw new NfsValidacaoError('Escolha o serviço.');
  if (!texto(e.descr, 2000)) throw new NfsValidacaoError('Informe a discriminação do serviço.');
  const v = calcularValoresNota(e);
  if (v.valor_servico <= 0) throw new NfsValidacaoError('Informe o valor do serviço.');
  if (v.valor_liquido < 0) throw new NfsValidacaoError('Descontos e retenções passam do valor do serviço.');

  const cli = (await db.query(`SELECT 1 FROM dbclien WHERE codcli = $1`, [e.codcli])).rowCount;
  if (!cli) throw new NfsValidacaoError('Cliente não encontrado.');
  const serv = (await db.query(`SELECT 1 FROM dbservico_nfs WHERE sen_id = $1`, [e.sen_id])).rowCount;
  if (!serv) throw new NfsValidacaoError('Serviço não encontrado no cadastro.');
  // VALIDA_NF_SERVICO: mesma nota ativa — pela chave (nacional) ou nº + verificação (prefeitura)
  const dup = (await db.query(
    `SELECT codfat FROM nfs_nota
      WHERE cancel = 'N' AND (($3::text IS NOT NULL AND chave_acesso = $3)
                              OR ($2::text IS NOT NULL AND nroform = $1 AND upper(verificacao) = upper($2)))
      LIMIT 1`,
    [nroform, verificacao, chave])).rows[0];
  if (dup) throw new NfsValidacaoError(`Esta nota já foi lançada (fatura ${dup.codfat}).`);

  // FATURA_NFS_INCLUIR: codfat = maior + 1 (8 dígitos), com trava
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('nfs_nota.codfat'))`);
  const codfat = String(Number((await db.query(
    `SELECT COALESCE(MAX(codfat::bigint), 0) + 1 AS n FROM nfs_nota WHERE codfat ~ '^[0-9]+$'`)).rows[0].n)).padStart(8, '0');

  await db.query(
    `INSERT INTO nfs_nota (codfat, nroform, verificacao, chave_acesso, codcli, dtemissao, competencia, data, totalnfs, totalfat,
        tipofat, valor_servico, valor_desconto, valor_deducoes, issqn_basecalculo, issqn_aliquota, issqn_retido,
        issqn_valor, pis_valor, cofins_valor, ir_valor, inss_valor, csll_valor, outros_valor, aliquota_pis,
        aliquota_cofins, aliquota_ir, aliquota_inss, aliquota_csll, cst_pis, cst_cofins, obs, tipo, cancel, origem, codusr)
     VALUES ($1,$2,$3,$30,$4,$5,$6,(now() AT TIME ZONE 'America/Manaus')::date,$7,$7,'4',$8,$9,$10,$11,$12,$13,$14,$15,$16,
             $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,2,'N',$31,$29)`,
    [codfat, nroform, verificacao, e.codcli, e.dtemissao, e.competencia, v.valor_liquido,
     v.valor_servico, v.valor_desconto, v.valor_deducoes, v.issqn_basecalculo, v.issqn_aliquota, v.issqn_retido,
     v.issqn_valor, v.pis_valor, v.cofins_valor, v.ir_valor, v.inss_valor, v.csll_valor, v.outros_valor,
     v.aliquota_pis, v.aliquota_cofins, v.aliquota_ir, v.aliquota_inss, v.aliquota_csll,
     texto(e.cst_pis, 2), texto(e.cst_cofins, 2), texto(e.obs, 255), codusr ? String(codusr).slice(0, 4) : null, chave,
     extra.origem || 'WEB']);
  if (extra.xml) await db.query(`UPDATE nfs_nota SET xml = $2 WHERE codfat = $1`, [codfat, extra.xml]);
  await db.query(
    `INSERT INTO nfs_nota_servico (codfat, sen_id, descr, qtde, prunit) VALUES ($1,$2,$3,1,$4)`,
    [codfat, e.sen_id, texto(e.descr, 2000), v.valor_servico]);
  return { codfat, valores: v };
}

// ------------------------------------------------------------------ cancelamento

/**
 * CANCELA_NFS: cancela a nota e os títulos. Diferente do Delphi, NÃO cancela se algum título
 * já tiver recebimento (precisa estornar antes no Contas a Receber).
 */
export async function cancelarNotaServico(db: Consultavel, codfat: string, usuario: string, motivo?: string | null) {
  const nota = (await db.query(`SELECT cancel FROM nfs_nota WHERE codfat = $1 FOR UPDATE`, [codfat])).rows[0];
  if (!nota) throw new NfsValidacaoError('Nota não encontrada.');
  if (nota.cancel === 'S') throw new NfsValidacaoError('A nota já está cancelada.');
  const recebidos = (await db.query(
    `SELECT count(*)::int n FROM dbreceb WHERE tipo = 'S' AND cod_fat = $1 AND COALESCE(cancel,'N') <> 'S'
        AND (rec = 'S' OR COALESCE(valor_rec,0) > 0)`, [codfat])).rows[0].n;
  if (recebidos > 0) {
    throw new NfsValidacaoError(`A nota tem ${recebidos} título(s) com recebimento. Estorne no Contas a Receber antes de cancelar.`);
  }
  const t = await db.query(
    `UPDATE dbreceb SET cancel = 'S' WHERE tipo = 'S' AND cod_fat = $1 AND COALESCE(cancel,'N') <> 'S'`, [codfat]);
  await db.query(
    `UPDATE nfs_nota SET cancel = 'S', cancelado_em = now(), cancelado_por = $2,
            obs = left(COALESCE(obs,'') || $3, 255), atualizado_em = now()
      WHERE codfat = $1`,
    [codfat, String(usuario || 'Sistema').slice(0, 60), motivo ? ` | Cancelada: ${String(motivo).slice(0, 120)}` : '']);
  return { titulosCancelados: t.rowCount || 0 };
}

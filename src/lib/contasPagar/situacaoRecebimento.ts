/**
 * Situação de RECEBIMENTO FÍSICO da(s) nota(s) de um título a pagar (coluna/cores do Contas a Pagar).
 * Decisão do usuário em 24/11/2026: o que vale é a mercadoria ter CHEGADO — a conferência finalizada
 * na tela de Recebimento —, não a entrada (dbent) ter sido gerada.
 *
 * Fluxo da entrada (dbent_recebimento.status / entrada_operacoes.status):
 *   PENDENTE → PRECO_CONFIRMADO → AGUARDANDO_RECEBIMENTO → EM_RECEBIMENTO → RECEBIDO
 *   → EM_ALOCACAO → ALOCADO / DISPONIVEL_VENDA            (CANCELADA = entrada cancelada)
 *
 * Situações:
 *   recebida        conferência finalizada (RECEBIDO em diante) em TODAS as notas do título;
 *                   entrada antiga do Delphi (sem registro de recebimento) conta como recebida
 *   em_recebimento  conferência iniciada, ou só parte das notas do título recebida
 *   nao_recebida    nota sem entrada / pendente / preço confirmado / aguardando; adiantamento sem nota
 *   cancelada       entrada da nota cancelada
 *   avulso          título lançado à mão com NF que não está no sistema
 *   null            título sem NF e fora do Compras
 * Nota do título: dbpgto_nota (migration 089) → dbnfe_ent.chave → dbent.chave.
 * Título avulso/antigo sem vínculo: dbent do mesmo fornecedor com o nº da NF na chave.
 */

export type SituacaoRecebimento = 'recebida' | 'em_recebimento' | 'nao_recebida' | 'cancelada' | 'avulso';
export const SITUACOES_RECEBIMENTO: SituacaoRecebimento[] = ['recebida', 'em_recebimento', 'nao_recebida', 'cancelada', 'avulso'];

const RECEBIDO_EM_DIANTE = `('RECEBIDO','EM_ALOCACAO','ALOCADO','DISPONIVEL_VENDA')`;

/** Situação de UMA entrada: `e` = dbent (pode ser NULL), `r` = dbent_recebimento, `op` = entrada_operacoes. */
export const sqlSituacaoEntrada = (e = 'e', r = 'r', op = 'op') => `CASE
    WHEN ${e}.codent IS NULL THEN 'nao_recebida'
    WHEN COALESCE(${e}.status,'') = 'C' OR ${r}.status = 'CANCELADA' THEN 'cancelada'
    WHEN ${r}.status IN ${RECEBIDO_EM_DIANTE} OR ${op}.status IN ${RECEBIDO_EM_DIANTE} THEN 'recebida'
    WHEN ${r}.status = 'EM_RECEBIMENTO' OR ${op}.status = 'EM_RECEBIMENTO' THEN 'em_recebimento'
    WHEN ${r}.codent IS NULL AND ${op}.codent IS NULL THEN 'recebida'   -- entrada antiga do Delphi
    ELSE 'nao_recebida' END`;

/** Entrada mais relevante de uma condição (não cancelada primeiro) + recebimento, como LATERAL. */
const lateralEntrada = (where: string) => `
    LEFT JOIN LATERAL (
      SELECT e1.codent, e1.status FROM dbent e1 WHERE ${where}
       ORDER BY (COALESCE(e1.status,'') = 'C'), e1.codent DESC LIMIT 1
    ) e ON true
    LEFT JOIN dbent_recebimento r ON r.codent = e.codent
    LEFT JOIN entrada_operacoes op ON op.codent = e.codent`;

/** Número da NF tirado da chave da entrada (mesma expressão do índice da migration 092). */
export const SQL_NF_DA_CHAVE = (alias: string) => `ltrim(substring(${alias}.chave FROM 26 FOR 9), '0')`;

/** Situação de recebimento de uma NOTA (`n` = dbnfe_ent). */
export const sqlSituacaoNota = (n = 'n') => `(
    SELECT ${sqlSituacaoEntrada()} FROM (SELECT 1) _u
    ${lateralEntrada(`e1.chave = ${n}.chave`)}
  )`;

/** Situação de recebimento de um TÍTULO (`p` = dbpgto). */
export const sqlSituacaoTitulo = (p = 'p') => `
  CASE
    WHEN EXISTS (SELECT 1 FROM dbpgto_nota tn WHERE tn.cod_pgto = ${p}.cod_pgto) THEN (
      SELECT CASE
               WHEN bool_and(x.s = 'recebida') THEN 'recebida'
               WHEN bool_and(x.s = 'cancelada') THEN 'cancelada'
               WHEN bool_or(x.s IN ('recebida','em_recebimento')) THEN 'em_recebimento'
               ELSE 'nao_recebida'
             END
        FROM (SELECT ${sqlSituacaoNota('n')} AS s
                FROM dbpgto_nota tn JOIN dbnfe_ent n ON n.codnfe_ent = tn.codnfe_ent
               WHERE tn.cod_pgto = ${p}.cod_pgto) x)
    WHEN (${p}.ordem_compra IS NOT NULL AND ${p}.ordem_compra NOT IN ('[]',''))
      OR EXISTS (SELECT 1 FROM ordem_pagamento_conta oc WHERE oc.cod_pgto = ${p}.cod_pgto) THEN 'nao_recebida'
    WHEN COALESCE(${p}.nro_nf,'') <> '' THEN COALESCE((
      SELECT CASE WHEN e.codent IS NULL THEN NULL ELSE ${sqlSituacaoEntrada()} END FROM (SELECT 1) _u
      ${lateralEntrada(`e1.cod_credor = ${p}.cod_credor AND ${SQL_NF_DA_CHAVE('e1')} = ltrim(${p}.nro_nf, '0')`)}
    ), 'avulso')
    ELSE NULL
  END`;

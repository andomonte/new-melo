import { RelatorioValidacaoError, type Consultavel } from '../tipos';

/**
 * Apoio dos relatórios do lote C (produto / estoque / compras).
 * Só funções puras: nada de SQL com valor do usuário concatenado — os helpers devolvem
 * trechos com placeholders e empurram os valores em `params`.
 */

/** Converte para número os campos indicados (o pg devolve numeric como string). */
export function numeros<T extends Record<string, any>>(rows: T[], campos: string[]): T[] {
  for (const r of rows) {
    for (const c of campos) {
      const o = r as Record<string, any>;
      if (o[c] != null) o[c] = Number(o[c]);
    }
  }
  return rows;
}

/**
 * Condição de período sobre uma coluna de data/hora: col >= de AND col < ate + 1 dia
 * (pega o dia final inteiro e continua usando índice). Valores vão para `params`.
 */
export function condPeriodo(col: string, params: any[], de?: string | null, ate?: string | null): string[] {
  const c: string[] = [];
  if (de) { params.push(de); c.push(`${col} >= $${params.length}::date`); }
  if (ate) { params.push(ate); c.push(`${col} < ($${params.length}::date + 1)`); }
  return c;
}

export function exigirPeriodo(p: Record<string, any>) {
  if (!p.de || !p.ate) throw new RelatorioValidacaoError('Informe o período.');
}

/** Limita o período (em dias) para relatórios pesados. */
export function limitarPeriodo(p: Record<string, any>, maxDias: number) {
  if (!p.de || !p.ate) return;
  const dias = (Date.parse(`${p.ate}T00:00:00Z`) - Date.parse(`${p.de}T00:00:00Z`)) / 86400000;
  if (dias > maxDias) throw new RelatorioValidacaoError(`Período máximo de ${maxDias} dias para este relatório.`);
}

/**
 * As tabelas grandes do db_manaus nunca passaram por ANALYZE: o planejador estima ~2 vendas num
 * período de meses e escolhe laço aninhado varrendo o índice de dbitvenda (minutos). Para as
 * consultas por período, desliga o nested loop só durante a consulta (SET LOCAL, dentro da
 * transação somente leitura da API) e religa em seguida.
 */
export async function semNestedLoop<T>(db: Consultavel, fn: () => Promise<T>): Promise<T> {
  await db.query('SET LOCAL enable_nestloop = off');
  const r = await fn(); // em erro a transação é desfeita pela API (e o SET LOCAL junto)
  await db.query('SET LOCAL enable_nestloop = on');
  return r;
}

export const somar = (rows: Record<string, any>[], campo: string) =>
  rows.reduce((s, r) => s + (Number(r[campo]) || 0), 0);

export const fmtNum = (v: number, casas = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Saldo em requisições de compra (trânsito), mesmo critério da Sugestão de Compras do web. */
export const SQL_SALDO_PEDIDO = (colCodprod: string) => `COALESCE((
    SELECT SUM(ir.itr_quantidade - COALESCE(ir.itr_quantidade_atendida, 0))
      FROM cmp_it_requisicao ir
      JOIN cmp_requisicao r ON r.req_id = ir.itr_req_id AND r.req_versao = ir.itr_req_versao
     WHERE ir.itr_codprod = ${colCodprod}
       AND r.req_status IN ('S', 'A')
       AND ir.itr_quantidade > COALESCE(ir.itr_quantidade_atendida, 0)), 0)`;

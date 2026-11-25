import type { Consultavel } from '../tipos';

/**
 * Utilitários do lote D (Licitações, FAG, SONY, HBUSTER, SACHS).
 * Vínculo venda → fatura: o legado usa DBFECHARVENDAS; o web grava fatura_venda. No PG as duas
 * têm só o que foi faturado pelo sistema novo (desde 08/2025), por isso juntamos as duas.
 */
export const VINCULO_VENDA_FATURA = `(
  SELECT codfat, codvenda FROM dbfecharvendas
  UNION
  SELECT codfat, codvenda FROM fatura_venda WHERE status = 'ativo'
)`;

/** Converte para número os campos indicados (o pg devolve numeric como string). */
export function numeros<T extends Record<string, any>>(rows: T[], campos: string[]): T[] {
  return rows.map((r) => {
    const o: Record<string, any> = { ...r };
    for (const c of campos) o[c] = o[c] == null ? null : Number(o[c]);
    return o as T;
  });
}

/** Lista de códigos separados por vírgula/espaço (filtro texto) → array sem vazios, ou null. */
export function listaCodigos(v: any): string[] | null {
  const l = String(v ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return l.length ? l : null;
}

/** Nome da filial atual (tb_filial do schema corrente), para a coluna "Origem". */
export const NOME_FILIAL_SQL = `(SELECT 'MELO ' || tf.nome_filial FROM tb_filial tf WHERE tf.schema_db = current_schema() LIMIT 1)`;

/**
 * As tabelas grandes do db_manaus nunca passaram por ANALYZE e dbitvenda não tem índice por codvenda:
 * o planejador estima poucas vendas e escolhe laço aninhado (minutos). Desliga o nested loop só
 * durante a consulta (SET LOCAL, dentro da transação somente leitura da API) e religa em seguida.
 */
export async function semLacoAninhado<T>(db: Consultavel, fn: () => Promise<T>): Promise<T> {
  await db.query('SET LOCAL enable_nestloop = off');
  const r = await fn(); // em erro a API desfaz a transação (e o SET LOCAL junto)
  await db.query('SET LOCAL enable_nestloop = on');
  return r;
}

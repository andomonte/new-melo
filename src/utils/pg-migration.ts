// Utilitários para migração de Prisma para pg
import { getPgPool } from '@/lib/pg';

// Função para executar queries paginadas
export async function executePaginatedQuery(
  tableName: string,
  selectFields: string,
  whereClause: string = '',
  orderBy: string = '',
  page: number = 1,
  perPage: number = 10,
  params: any[] = []
) {
  const pool = getPgPool();
  const offset = (page - 1) * perPage;

  let query = `SELECT ${selectFields} FROM ${tableName}`;
  let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;

  if (whereClause) {
    query += ` WHERE ${whereClause}`;
    countQuery += ` WHERE ${whereClause}`;
  }

  if (orderBy) {
    query += ` ORDER BY ${orderBy}`;
  }

  query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(perPage, offset);

  const [dataResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, params.slice(0, -2))
  ]);

  const total = parseInt(countResult.rows[0].total);
  const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;
  const currentPage = total > 0 ? page : 1;

  return {
    data: dataResult.rows,
    meta: {
      total,
      lastPage,
      currentPage,
      perPage
    }
  };
}

// Função para busca com LIKE em múltiplos campos
export function buildSearchClause(search: string, fields: string[]): { clause: string; params: any[] } {
  if (!search || fields.length === 0) {
    return { clause: '', params: [] };
  }

  const conditions = fields.map((field, index) => `LOWER(${field}) LIKE LOWER($${index + 1})`);
  const clause = `(${conditions.join(' OR ')})`;
  const params = fields.map(() => `%${search}%`);

  return { clause, params };
}

// Função para converter valores numéricos
export function convertNumericFields<T extends Record<string, any>>(obj: T, numericFields: (keyof T)[]): T {
  const result = { ...obj };
  numericFields.forEach(field => {
    if (result[field] !== null && result[field] !== undefined) {
      (result as any)[field] = Number(result[field]);
    }
  });
  return result;
}

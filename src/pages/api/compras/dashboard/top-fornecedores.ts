// src/pages/api/compras/dashboard/top-fornecedores.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { TopFornecedor, getDateRange } from './dashboardUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopFornecedor[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client: any;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const range = (req.query.range as string) || 'ultimos_30_dias';
    const { startDate, endDate } = getDateRange(range);

    try {
      // Query para buscar os top 10 fornecedores por valor total de compras
      // Exclui fornecedor "TESTE" e valores absurdos (>100M)
      const query = `
        SELECT
          c.cod_credor AS "codCredor",
          c.nome AS "nomeFornecedor",
          COALESCE(SUM(o.orc_valor_total), 0) AS "totalCompras",
          COUNT(o.orc_id) AS "totalOrdens"
        FROM db_manaus.dbcredor c
        INNER JOIN db_manaus.cmp_requisicao r ON c.cod_credor = r.req_cod_credor
        INNER JOIN db_manaus.cmp_ordem_compra o ON r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao
        WHERE o.orc_status IN ('A', 'F')
          AND o.orc_data BETWEEN $1 AND $2
          AND o.orc_valor_total < 100000000
          AND UPPER(c.nome) NOT LIKE '%TESTE%'
        GROUP BY c.cod_credor, c.nome
        HAVING SUM(o.orc_valor_total) > 0
        ORDER BY "totalCompras" DESC
        LIMIT 10
      `;

      const result = await client.query(query, [startDate, endDate]);

      const topFornecedores: TopFornecedor[] = result.rows.map((row: any) => ({
        codCredor: row.codCredor,
        nomeFornecedor: row.nomeFornecedor,
        totalCompras: parseFloat(row.totalCompras) || 0,
        totalOrdens: parseInt(row.totalOrdens) || 0,
      }));

      res.status(200).json(serializeBigInt(topFornecedores));
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar top fornecedores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

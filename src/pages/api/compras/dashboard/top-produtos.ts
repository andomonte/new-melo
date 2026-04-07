// src/pages/api/compras/dashboard/top-produtos.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { TopProdutoComprado, getDateRange } from './dashboardUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopProdutoComprado[] | { error: string }>,
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
      // Query para buscar os top 5 produtos mais comprados
      // Exclui valores absurdos (>100M) que são de teste
      const query = `
        SELECT
          p.codprod,
          p.descr AS "nomeProduto",
          SUM(i.itr_quantidade) AS "quantidadeComprada",
          SUM(i.itr_quantidade * i.itr_pr_unitario) AS "valorTotal"
        FROM db_manaus.cmp_it_requisicao i
        INNER JOIN db_manaus.cmp_requisicao r ON i.itr_req_id = r.req_id AND i.itr_req_versao = r.req_versao
        INNER JOIN db_manaus.dbprod p ON i.itr_codprod = p.codprod
        INNER JOIN db_manaus.cmp_ordem_compra o ON r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao
        WHERE o.orc_status IN ('A', 'F')
          AND o.orc_data BETWEEN $1 AND $2
          AND o.orc_valor_total < 100000000
        GROUP BY p.codprod, p.descr
        HAVING SUM(i.itr_quantidade * i.itr_pr_unitario) > 0
        ORDER BY "valorTotal" DESC
        LIMIT 5
      `;

      const result = await client.query(query, [startDate, endDate]);

      const topProdutos: TopProdutoComprado[] = result.rows.map((row: any) => ({
        codprod: row.codprod,
        nomeProduto: row.nomeProduto,
        quantidadeComprada: parseFloat(row.quantidadeComprada) || 0,
        valorTotal: parseFloat(row.valorTotal) || 0,
      }));

      res.status(200).json(serializeBigInt(topProdutos));
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar top produtos comprados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

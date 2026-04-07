// src/pages/api/vendas/dashboard/top-clientes.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export type TopCliente = {
  codcli: string;
  nomeCliente: string;
  totalVendas: number;
  totalPedidos: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopCliente[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client: any;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    try {
      // Query para buscar os top 10 clientes por valor total de vendas
      const query = `
        SELECT 
          c.codcli,
          c.nome as "nomeCliente",
          COALESCE(SUM(v.total), 0) as "totalVendas",
          COUNT(v.codvenda) as "totalPedidos"
        FROM dbclien c
        LEFT JOIN dbvenda v ON c.codcli = v.codcli 
          AND COALESCE(v.cancel, 'N') != 'S'
        GROUP BY c.codcli, c.nome
        HAVING SUM(v.total) > 0
        ORDER BY "totalVendas" DESC
        LIMIT 10
      `;

      const result = await client.query(query);

      const topClientes: TopCliente[] = result.rows.map((row: any) => ({
        codcli: row.codcli,
        nomeCliente: row.nomeCliente,
        totalVendas: parseFloat(row.totalVendas) || 0,
        totalPedidos: parseInt(row.totalPedidos) || 0,
      }));

      res.status(200).json(serializeBigInt(topClientes));
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar top clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

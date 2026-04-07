import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;
  const { dataInicio, dataFim } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }

  if (!dataInicio || !dataFim) {
    return res
      .status(400)
      .json({ error: 'Data início e data fim são obrigatórias' });
  }

  const pool = getPgPool();

  try {
    // Buscar compras do cliente no período
    const query = `
      SELECT 
        nronf as nf,
        data,
        total as "valorTotal",
        CASE 
          WHEN cancel = 'S' THEN 'Cancelada'
          ELSE 'Concluída'
        END as status
      FROM dbvenda
      WHERE codcli = $1
        AND data >= $2
        AND data <= $3
        AND tipo IN ('V', 'O')
      ORDER BY data DESC
    `;

    const result = await pool.query(query, [id, dataInicio, dataFim]);

    const compras = result.rows.map((row) => ({
      nf: row.nf || 'S/N',
      data: row.data ? new Date(row.data).toLocaleDateString('pt-BR') : '-',
      valorTotal: parseFloat(row.valorTotal || 0),
      status: row.status,
    }));

    return res.status(200).json({ compras });
  } catch (error) {
    console.error('Erro ao buscar compras por intervalo:', error);
    return res.status(500).json({
      error: 'Erro ao buscar compras',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

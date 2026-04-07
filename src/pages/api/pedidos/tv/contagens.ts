import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface ContagensPedidos {
  aguardando: number;
  emSeparacao: number;
  separados: number;
  emConferencia: number;
  total: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Query para buscar todas as contagens de uma vez (excluindo pedidos conferidos)
    const contagensQuery = `
      SELECT 
        COUNT(CASE WHEN statuspedido = '1' THEN 1 END) as aguardando,
        COUNT(CASE WHEN statuspedido = '2' THEN 1 END) as em_separacao,
        COUNT(CASE WHEN statuspedido = '3' THEN 1 END) as separados,
        COUNT(CASE WHEN statuspedido = '4' THEN 1 END) as em_conferencia,
        COUNT(*) as total
      FROM dbvenda v
      WHERE v.statuspedido IN ('1', '2', '3', '4')
    `;

    const result = await client.query(contagensQuery);
    const row = result.rows[0];

    const contagens: ContagensPedidos = {
      aguardando: parseInt(row.aguardando, 10) || 0,
      emSeparacao: parseInt(row.em_separacao, 10) || 0,
      separados: parseInt(row.separados, 10) || 0,
      emConferencia: parseInt(row.em_conferencia, 10) || 0,
      total: parseInt(row.total, 10) || 0,
    };

    return res.status(200).json(contagens);
  } catch (error) {
    console.error('Erro ao buscar contagens de pedidos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
}

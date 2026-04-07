import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem é obrigatório e deve ser um número'
    });
  }

  const ordemId = Number(id);

  try {
    const client = await pool.connect();

    const result = await client.query(
      'SELECT orc_id, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
      [ordemId]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const ordem = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        ordemId: ordem.orc_id,
        status: ordem.orc_status
      }
    });
  } catch (err) {
    console.error('Erro ao buscar status da ordem:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar status da ordem',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}
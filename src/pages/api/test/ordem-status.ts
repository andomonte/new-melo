import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
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

    // Verificar se a ordem existe
    const checkResult = await client.query(
      'SELECT orc_id, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
      [ordemId]
    );

    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    console.log('DEBUG - Ordem encontrada:', checkResult.rows[0]);

    // Tentar atualizar apenas para 'A' (1 caractere)
    const updateResult = await client.query(
      `UPDATE db_manaus.cmp_ordem_compra
       SET orc_status = 'A'
       WHERE orc_id = $1
       RETURNING orc_id, orc_status`,
      [ordemId]
    );

    client.release();

    console.log('DEBUG - Ordem atualizada:', updateResult.rows[0]);

    res.status(200).json({
      success: true,
      message: 'Status atualizado para A',
      data: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Erro no teste:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}
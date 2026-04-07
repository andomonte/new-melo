import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const requisitionId = Number(id);

    // Check if requisition exists and get current status
    const checkQuery = `
      SELECT req_status as statusRequisicao, req_id_composto as requisicao 
      FROM cmp_requisicao 
      WHERE req_id = $1
    `;
    
    const client = await pool.connect();
    const existingRecord = await client.query(checkQuery, [requisitionId]);
    client.release();
    
    if (!existingRecord || existingRecord.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requisição não encontrada'
      });
    }

    const currentRecord = existingRecord.rows[0];

    // Validate that requisition can be deleted (only pending requisitions)
    if (currentRecord.statusRequisicao !== 'P') {
      return res.status(400).json({
        success: false,
        message: 'Apenas requisições Pendentes podem ser excluídas'
      });
    }

    // Start transaction
    const client2 = await pool.connect();
    await client2.query('BEGIN');

    try {
      // Delete related items first
      await client2.query(
        'DELETE FROM cmp_it_requisicao WHERE itr_req_id = $1',
        [requisitionId]
      );

      // Delete the requisition
      await client2.query(
        'DELETE FROM cmp_requisicao WHERE req_id = $1',
        [requisitionId]
      );

      // Commit transaction
      await client2.query('COMMIT');
      client2.release();

      res.status(200).json({
        success: true,
        message: 'Requisição excluída com sucesso'
      });

    } catch (error) {
      // Rollback on error
      await client2.query('ROLLBACK');
      client2.release();
      throw error;
    }

  } catch (error) {
    console.error('Error deleting requisition:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}
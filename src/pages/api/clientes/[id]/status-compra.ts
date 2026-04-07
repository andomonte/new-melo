import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }

  const pool = getPgPool();

  try {
    if (req.method === 'GET') {
      // Buscar status atual do cliente
      const result = await pool.query(
        `SELECT status FROM dbclien WHERE codcli = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      const status = result.rows[0].status || 'S'; // Default: Ativo

      return res.status(200).json({ status });
    } else if (req.method === 'PUT') {
      // Atualizar status do cliente
      const { status } = req.body;

      if (!status || !['S', 'N', 'B', 'P'].includes(status)) {
        return res.status(400).json({
          error:
            'Status inválido. Use: S (Ativo), N (Inativo), B (Bloqueado), P (Pendente)',
        });
      }

      // Verificar se o cliente existe
      const checkResult = await pool.query(
        `SELECT codcli FROM dbclien WHERE codcli = $1`,
        [id],
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      // Atualizar o status
      await pool.query(`UPDATE dbclien SET status = $1 WHERE codcli = $2`, [
        status,
        id,
      ]);

      return res.status(200).json({
        success: true,
        message: 'Status atualizado com sucesso',
        status,
      });
    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      return res
        .status(405)
        .json({ error: `Método ${req.method} não permitido` });
    }
  } catch (error) {
    console.error('Erro ao processar status de compra:', error);
    return res.status(500).json({
      error: 'Erro ao processar requisição',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

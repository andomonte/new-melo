import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, status } = req.body;

  if (!nfeId || !status) {
    return res.status(400).json({ error: 'nfeId e status são obrigatórios' });
  }

  let client;

  try {
    client = await pool.connect();

    // Atualizar status da NFe
    // status: 'PENDENTE', 'ASSOCIACAO_CONCLUIDA', 'PROCESSADA', etc
    await client.query(`
      UPDATE db_manaus.nfe_entrada
      SET status = $1,
          updated_at = NOW()
      WHERE numero_nf = $2
    `, [status, nfeId]);

    console.log(`✅ Status da NFe ${nfeId} atualizado para: ${status}`);

    res.status(200).json({
      success: true,
      message: 'Status da NFe atualizado com sucesso'
    });
  } catch (err) {
    console.error('Erro ao atualizar status da NFe:', err);
    res.status(500).json({
      error: 'Falha ao atualizar status da NFe',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

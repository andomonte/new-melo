// pages/api/mensagens/listar.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const result = await getPgPool().query(
      'SELECT * FROM dbmensagens ORDER BY codigo DESC',
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar mensagens:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

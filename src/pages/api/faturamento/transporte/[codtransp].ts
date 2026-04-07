import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { cod } = req.query;

  if (!cod || typeof cod !== 'string') {
    return res.status(400).json({ error: 'Código da transportadora inválido' });
  }

  try {
    const client = await getPgPool().connect();

    const result = await client.query(
      `SELECT codtransp, nome FROM dbtransp WHERE codtransp = $1`,
      [cod],
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transportadora não encontrada' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar transportadora:', error);
    res.status(500).json({ error: 'Erro ao buscar transportadora' });
  }
}

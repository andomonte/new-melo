import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codcli } = req.query;

  try {
    const client = await getPgPool().connect();

    let query = `
      SELECT DISTINCT codgp
      FROM dbfatura
      WHERE codgp IS NOT NULL AND agp = 'S'
    `;
    const params: any[] = [];

    if (codcli && typeof codcli === 'string') {
      query += ` AND codcli = $1`;
      params.push(codcli);
    }

    query += ` ORDER BY codgp`;

    const result = await client.query(query, params);
    client.release();

    return res.status(200).json({ grupos: result.rows });
  } catch (error) {
    console.error('Erro ao listar grupos de pagamento:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao listar grupos de pagamento.' });
  }
}

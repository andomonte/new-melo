import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT "CODIGO_TELA", "NOME_TELA", "PATH_TELA"
      FROM tb_telas
      ORDER BY "NOME_TELA" ASC;
    `;

    const result = await client.query(query);

    return res.status(200).json(serializeBigInt(result.rows));
  } catch (error) {
    console.error('Erro ao buscar telas:', error);
    return res.status(500).json({ error: 'Erro ao buscar telas.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

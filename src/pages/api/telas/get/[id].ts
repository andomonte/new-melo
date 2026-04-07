import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;
  let client;

  if (!id) {
    return res.status(400).json({ error: 'O ID da tela é obrigatório.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT "CODIGO_TELA", "NOME_TELA", "PATH_TELA"
      FROM tb_telas
      WHERE "CODIGO_TELA" = $1;
    `;

    const result = await client.query(query, [Number(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tela não encontrada.' });
    }

    return res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(result.rows[0]));
  } catch (error) {
    console.error('Erro ao buscar tela:', error);
    return res.status(500).json({ error: 'Erro ao buscar tela.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

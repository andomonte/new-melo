import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT id_functions, descricao, codigo_filial, "usadoEm", sigla
      FROM tb_login_functions
      ORDER BY descricao ASC;
    `;

    const result = await client.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar funções:', error);
    res.status(500).json({ error: 'Erro ao buscar funções.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

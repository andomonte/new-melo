import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;
  let client;

  if (!id) {
    res.status(400).json({ error: 'ID Obrigatório.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT id_functions, descricao, codigo_filial, "usadoEm", sigla
      FROM tb_login_functions
      WHERE id_functions = $1;
    `;

    const result = await client.query(query, [Number(id)]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Função não encontrada' });
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar função:', error);
    res.status(500).json({ error: 'Erro interno ao buscar a função.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

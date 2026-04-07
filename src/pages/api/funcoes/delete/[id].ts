import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;
  let client;

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).json({ error: `Método ${req.method} não permitido.` });
    return;
  }

  if (!id) {
    res.status(400).json({ error: 'ID da Função é obrigatório.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // Verificar se a função existe
    const checkQuery = `
      SELECT id_functions
      FROM tb_login_functions
      WHERE id_functions = $1;
    `;
    const checkResult = await client.query(checkQuery, [Number(id)]);

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Função não encontrada.' });
      return;
    }

    // Deletar a função
    const deleteQuery = `
      DELETE FROM tb_login_functions
      WHERE id_functions = $1;
    `;
    await client.query(deleteQuery, [Number(id)]);

    res.status(200).json({ message: 'Função deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar a função:', error);
    res.status(500).json({ error: 'Erro interno ao deletar a função.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

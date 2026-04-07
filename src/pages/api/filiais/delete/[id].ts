import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;

  const { id } = req.query;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da filial é obrigatório.' });
  }

  try {
    const filialId = parseInt(id, 10);
    if (isNaN(filialId)) {
      return res
        .status(400)
        .json({ error: 'ID da filial deve ser um número válido.' });
    }

    const pool = getPgPool();
    client = await pool.connect();

    // 1. Desconectar usuários da filial na tabela de junção tb_login_filiais
    const deleteFilialUsersQuery = `
      DELETE FROM tb_login_filiais WHERE codigo_filial = $1;
    `;
    await client.query(deleteFilialUsersQuery, [filialId]);

    // 2. Deletar a filial
    const deleteFilialQuery = `
      DELETE FROM tb_filial WHERE codigo_filial = $1 RETURNING *;
    `;
    const filialResult = await client.query(deleteFilialQuery, [filialId]);

    if (filialResult.rowCount === 0) {
      return res
        .status(404)
        .json({ error: `Filial com ID "${id}" não encontrada.` });
    }

    return res
      .status(200)
      .json({ message: `Filial com ID "${id}" deletada com sucesso.` });
  } catch (error: any) {
    console.error('Erro ao deletar filial:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao deletar filial: ' + error.message });
  } finally {
    if (client) client.release();
  }
}

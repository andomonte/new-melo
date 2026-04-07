import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da tela é obrigatório.' });
  }

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    const telaId = parseInt(id, 10);
    if (isNaN(telaId)) {
      return res
        .status(400)
        .json({ error: 'ID da tela deve ser um número válido.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Delete associated permissions in tb_grupo_Permissao
    await client.query(
      `DELETE FROM db_manaus."tb_grupo_Permissao" WHERE tela = $1`,
      [telaId],
    );

    // 2. Delete the tela from tb_telas
    const deleteResult = await client.query(
      `DELETE FROM db_manaus.tb_telas WHERE "CODIGO_TELA" = $1 RETURNING *`,
      [telaId],
    );

    await client.query('COMMIT');

    if (deleteResult.rows.length > 0) {
      return res
        .status(200)
        .json({ message: `Tela com ID "${id}" deletada com sucesso.` });
    } else {
      return res
        .status(404)
        .json({ error: `Tela com ID "${id}" não encontrada.` });
    }
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Erro ao deletar tela:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao deletar tela: ' + error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
}

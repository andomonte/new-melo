import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { user_login_id, nome_filial } = req.query;

  if (!user_login_id || !nome_filial) {
    return res
      .status(400)
      .json({ error: 'Parâmetros incompletos ou inválidos.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `
      SELECT perfil_name, codvend
      FROM tb_user_perfil
      WHERE user_login_id = $1 AND nome_filial = $2
      LIMIT 1;
      `,
      [user_login_id, nome_filial],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error, {
      user_login_id,
      nome_filial,
    });
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    if (client) client.release();
  }
}

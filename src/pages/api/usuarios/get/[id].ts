import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;
  let client: PoolClient | undefined;

  if (!id) {
    return res.status(400).json({ error: 'ID Obrigatório.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT
  u.login_user_login,
  u.login_user_name,
  u.login_user_obs,
  u.login_user_password,
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id_functions', a.id_functions
  )) FILTER (WHERE a.id_functions IS NOT NULL), '[]') AS funcoes,
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'perfil_name', up.perfil_name,
    'codigo_filial', up.codigo_filial,
    'nome_filial', up.nome_filial,
    'codvend', up.codvend
  )) FILTER (WHERE up.perfil_name IS NOT NULL), '[]') AS perfis
FROM tb_login_user u
LEFT JOIN tb_login_access_user a ON a.login_user_login = u.login_user_login
LEFT JOIN tb_user_perfil up ON up.user_login_id = u.login_user_login
WHERE u.login_user_login = $1
GROUP BY
  u.login_user_login,
  u.login_user_name,
  u.login_user_obs,
  u.login_user_password;

    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

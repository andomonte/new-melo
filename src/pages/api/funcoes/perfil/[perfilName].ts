import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial not provided in cookie.' });
  }

  const { perfilName } = req.query;

  if (!perfilName || typeof perfilName !== 'string') {
    return res.status(400).json({ error: 'Perfil name is required.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      SELECT f.id_functions, f.descricao
      FROM tb_login_access_perfil ap
      INNER JOIN tb_login_functions f ON ap.id_functions = f.id_functions
      WHERE ap.login_perfil_name = $1
      ORDER BY f.descricao;
    `;

    const { rows } = await client.query(query, [perfilName]);

    return res.status(200).json({ data: rows });
  } catch (error: any) {
    console.error('Erro ao buscar funções do perfil:', error);
    return res.status(500).json({ error: 'Erro ao buscar funções do perfil.' });
  } finally {
    if (client) client.release();
  }
}

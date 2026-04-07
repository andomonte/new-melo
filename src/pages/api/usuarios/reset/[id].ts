import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';

const SALT_ROUNDS = 10;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Método não permitido. Use PUT.' });
    return;
  }

  const { id } = req.query;
  const login_user_login = id;

  if (!login_user_login || typeof login_user_login !== 'string') {
    res.status(400).json({ error: 'login_user_login é obrigatório.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const checkUserQuery = `
      SELECT login_user_login FROM tb_login_user WHERE login_user_login = $1;
    `;
    const userResult = await client.query(checkUserQuery, [login_user_login]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(login_user_login, SALT_ROUNDS);

    const updateQuery = `
      UPDATE tb_login_user
      SET login_user_password = $1
      WHERE login_user_login = $2;
    `;
    await client.query(updateQuery, [hashedPassword, login_user_login]);

    res.status(200).json({ message: 'Senha resetada com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({ error: `Erro ao resetar senha: ${error.message}` });
  } finally {
    if (client) {
      client.release();
    }
  }
}

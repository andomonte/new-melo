import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  const { codusr, newPassword } = req.body;

  if (!codusr || typeof codusr !== 'string') {
    res
      .status(400)
      .json({ error: 'O código do usuário (codusr) é obrigatório.' });
    return;
  }

  if (!newPassword || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'A nova senha é obrigatória.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const checkUserQuery = `
      SELECT login_user_login FROM tb_login_user WHERE login_user_login = $1;
    `;
    const userResult = await client.query(checkUserQuery, [codusr]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const updatePasswordQuery = `
      UPDATE tb_login_user
      SET login_user_password = $1
      WHERE login_user_login = $2;
    `;
    await client.query(updatePasswordQuery, [hashedPassword, codusr]);

    res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao atualizar senha:', error);
    res
      .status(500)
      .json({ error: `Erro ao atualizar senha: ${error.message}` });
  } finally {
    if (client) client.release();
  }
}

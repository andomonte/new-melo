import { getPgPool } from '@/lib/pg';
import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { userLogin, userSenha } = req.body;

  try {
    const pool = getPgPool();

    // Buscar o usuário pelo login
    const userResult = await pool.query(
      `SELECT login_user_login, login_user_name, login_user_password, login_user_obs, login_perfil_name
       FROM tb_login_user
       WHERE login_user_login = $1`,
      [userLogin]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Comparar a senha usando bcrypt
    const isPasswordValid = await bcrypt.compare(
      userSenha,
      user.login_user_password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Estrutura de retorno
    const userData = {
      codusr: user.login_user_login, // Usando o 'login_user_login' como 'codusr'
      login_user_login: user.login_user_login,
      login_user_name: user.login_user_name,
      login_user_obs: user.login_user_obs,
      login_perfil_name: user.login_perfil_name,
    };

    res.status(200).json(serializeBigInt([userData]));
  } catch (error: any) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

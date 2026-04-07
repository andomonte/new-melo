import { getPgPool } from '@/lib/pg';
import { NextApiRequest, NextApiResponse } from 'next';
import { compare } from 'bcryptjs';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { userLogin, userSenha } = req.body;

  // 1. Valide a entrada
  if (!userLogin || !userSenha) {
    res.status(400).json({ error: 'Login e senha são obrigatórios.' });
    return;
  }

  // Login usa banco central fixo (tb_login_user está lá)
  const pool = getPgPool();
  let client: PoolClient | null = null;

  try {
    // 2. Busque o usuário pelo login usando a biblioteca pg
    client = await pool.connect(); // Obtém um cliente do pool de conexões
    client = await pool.connect(); // Obtém um cliente do pool de conexões
    const result = await client.query(
      'SELECT * FROM tb_login_user WHERE login_user_login = $1',
      [userLogin],
    );
    const user = result.rows[0]; // Pega o primeiro resultado

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }

    // 3. Compare a senha fornecida com o hash armazenado
    const senhaCorreta = await compare(userSenha, user.login_user_password);

    if (!senhaCorreta) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    // 4. Retorne os dados do usuário (sem a senha)
    const { _login_user_password, ...userData } = user; // Remove a senha do objeto

    res.status(200).json(userData);
  } catch (error: any) {
    console.error('Erro:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor: ' + error.message });
  } finally {
    // Sempre libera o cliente de volta para o pool
    if (client) {
      client.release();
    }
  }
}

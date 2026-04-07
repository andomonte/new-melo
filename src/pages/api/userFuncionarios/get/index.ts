import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const { page = '1', perPage = '10', search = '' } = req.query;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    // 1. A query de busca agora é na tabela tb_user_perfil
    // 2. O campo de busca foi alterado para 'user_login_id'
    const usersQuery = `
      SELECT * FROM tb_user_perfil
      WHERE user_login_id ILIKE $1
      ORDER BY user_login_id ASC
      LIMIT $2 OFFSET $3;
    `;

    const usersResult = await client.query(usersQuery, [
      `%${search}%`,
      limit,
      offset,
    ]);
    const users = usersResult.rows;

    // 1. A query de contagem também foi alterada para a tabela tb_user_perfil
    // 2. O campo de busca para a contagem também é 'user_login_id'
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tb_user_perfil
      WHERE user_login_id ILIKE $1;
    `;

    const countResult = await client.query(countQuery, [`%${search}%`]);
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json(
      serializeBigInt({
        data: users,
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / limit) : 1,
          currentPage: count > 0 ? Number(page) : 1,
          perPage: limit,
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar perfis de usuário:', error);
    res.status(500).json({
      message:
        'Erro ao buscar perfis de usuário. Tente novamente ou contate o suporte.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}

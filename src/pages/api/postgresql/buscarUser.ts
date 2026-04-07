import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { NextApiRequest, NextApiResponse } from 'next';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const dados = req.body;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();

    const result = await pool.query(
      'SELECT * FROM tb_login_user WHERE login_user_login = $1',
      [dados.userLogin]
    );

    res.status(200).setHeader('Content-Type', 'application/json').json(result.rows);
  } catch (errors) {
    console.log(errors);
    res.json('erro');
  }
}

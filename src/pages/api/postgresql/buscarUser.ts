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

    // Schema explícito (db_manaus = banco central de login). A tabela existe
    // em vários schemas com senhas distintas; qualificar evita depender do
    // search_path e o 401/dado errado intermitente. Ver verUser.ts.
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

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { Pedido } from '@/data/pedidos/pedidos';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { executeUpdateWithDtUpdate } from '@/lib/updateDtupdate';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { data, login_user_login }: { data: Pedido; login_user_login: string } =
    req.body;

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Criar pedido do usuário
    const pedidoUserResult = await client.query(
      `INSERT INTO tb_pedido_user (id_pedido, login_user_login, created_at)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.codvenda, login_user_login, new Date()],
    );

    // Atualizar status do pedido
    const novoStatus = data.status === 'N' ? 'S' : 'C';
    await executeUpdateWithDtUpdate(
      `UPDATE dbvenda SET status = $2 WHERE codvenda = $1`,
      [data.codvenda, novoStatus],
      client,
    );

    await client.query('COMMIT');

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(pedidoUserResult.rows[0]),
      });
  } catch (errors) {
    await client?.query('ROLLBACK');
    console.log(errors);
    res.status(500).json({ error: 'Erro ao adicionar pedido do usuário' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

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
  const { data }: { data: Pedido } = req.body;

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Atualizar status do pedido
    const pedidoResult = await executeUpdateWithDtUpdate(
      `UPDATE dbvenda SET statuspedido = '5' WHERE codvenda = $1 RETURNING *`,
      [data.codvenda],
      client,
    );

    // Buscar pedido do usuário
    const pedidoUserResult = await client.query(
      `SELECT id FROM tb_pedido_user WHERE id_pedido = $1 LIMIT 1`,
      [data.codvenda],
    );

    if (pedidoUserResult.rows.length > 0) {
      // Deletar pedido do usuário
      await client.query(`DELETE FROM tb_pedido_user WHERE id = $1`, [
        pedidoUserResult.rows[0].id,
      ]);
    }

    await client.query('COMMIT');

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(pedidoResult.rows[0]),
      });
  } catch (errors) {
    await client?.query('ROLLBACK');
    console.log(errors);
    res.status(500).json({ error: 'Erro ao confirmar conferência' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

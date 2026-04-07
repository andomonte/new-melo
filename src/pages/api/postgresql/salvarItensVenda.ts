import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN');

    const itemData = req.body;

    // Construir a query de inserção dinamicamente baseada nos campos enviados
    const fields = Object.keys(itemData);
    const values = Object.values(itemData);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const fieldNames = fields.map((field) => `"${field}"`).join(', ');

    const insertQuery = `
      INSERT INTO db_manaus.dbitvenda (${fieldNames})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await client.query(insertQuery, values);

    await client.query('COMMIT');

    res
      .status(200)
      .json({
        message: 'Item de venda criado com sucesso',
        data: result.rows[0],
      });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Erro ao salvar item de venda:', error);
    res.status(400).json({ error: 'Erro ao criar item no banco' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

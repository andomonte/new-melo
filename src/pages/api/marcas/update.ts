import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { codmarca, bloquear_preco, descr } = req.body;

    if (!codmarca || !descr) {
      res
        .status(400)
        .json({ error: 'Código da marca e descrição são obrigatórios.' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    // Processar bloquear_preco
    const bloquearPreco = bloquear_preco ? 'S' : 'N';

    // Atualizar marca
    const updateQuery = `
      UPDATE dbmarcas 
      SET descr = $1, bloquear_preco = $2
      WHERE codmarca = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      descr,
      bloquearPreco,
      codmarca.toString(),
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Marca não encontrada.' });
      return;
    }

    const updatedMarca = result.rows[0];

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({ data: serializeBigInt(updatedMarca) });
  } catch (error) {
    console.error('Erro ao atualizar marca:', error);
    res.status(500).json({
      error: 'Erro interno ao atualizar a marca.',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

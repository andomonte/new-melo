import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const data = req.body;

    if (!data.descr) {
      res.status(400).json({ error: 'Descrição é obrigatória' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    // Buscar o próximo código de marca
    const nextCodmarcaQuery = `
      SELECT codmarca FROM dbmarcas 
      ORDER BY CAST(codmarca AS INTEGER) DESC 
      LIMIT 1;
    `;
    const codmarcaResult = await client.query(nextCodmarcaQuery);
    const nextCodmarca =
      codmarcaResult.rows.length > 0
        ? (Number(codmarcaResult.rows[0].codmarca) + 1).toString()
        : '1';

    // Buscar o próximo mar_id
    const nextMarIdQuery = `
      SELECT mar_id FROM dbmarcas 
      ORDER BY mar_id DESC 
      LIMIT 1;
    `;
    const marIdResult = await client.query(nextMarIdQuery);
    const nextMarId =
      marIdResult.rows.length > 0 && marIdResult.rows[0].mar_id
        ? parseFloat(marIdResult.rows[0].mar_id) + 1.0
        : 1;

    // Processar bloquear_preco
    const bloquearPreco = data.bloquear_preco ? 'S' : 'N';

    // Inserir nova marca
    const insertQuery = `
      INSERT INTO dbmarcas (codmarca, descr, mar_id, bloquear_preco)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      nextCodmarca,
      data.descr,
      nextMarId,
      bloquearPreco,
    ]);

    const marca = insertResult.rows[0];

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(marca),
      });
  } catch (error) {
    console.error('Erro ao criar marca:', error);
    res.status(500).json({
      error: 'Erro interno ao criar a marca.',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

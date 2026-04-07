import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    const data = req.body;

    // Buscar o último código para gerar o próximo
    const lastCodeQuery = `
      SELECT codcc FROM dbcclien
      ORDER BY descr DESC
      LIMIT 1
    `;

    const lastCodeResult = await client.query(lastCodeQuery);
    const lastCode = lastCodeResult.rows[0]?.codcc;
    const newCode = lastCode ? (Number(lastCode) + 1).toString() : '0';

    // Inserir o novo registro
    const insertQuery = `
      INSERT INTO dbcclien (codcc, descr)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [newCode, data.nome]);

    await client.query('COMMIT');

    res.status(201).json({ data: serializeBigInt(result.rows[0]) });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Erro ao criar a classe cliente:', error);
    res.status(500).json({ error: 'Erro ao criar classCliente' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

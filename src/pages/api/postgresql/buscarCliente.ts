import { getPgPool } from '@/lib/pgClient'; // ← multi-banco por filial
import { PoolClient } from 'pg';
import { NextApiRequest, NextApiResponse } from 'next';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies'; // ← lê a filial do cookie

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const dados = req.body;
  let client: PoolClient | undefined;

  try {
    const { filial_melo } = parseCookies({ req });
    if (!filial_melo || !String(filial_melo).trim()) {
      return res
        .status(400)
        .json({ error: 'Cookie "filial_melo" ausente ou inválido.' });
    }

    const pool = getPgPool(filial_melo);
    client = await pool.connect();

    const clienteQuery = `
      SELECT * FROM db_manaus.dbclien
      WHERE codigo_filial = $1
    `;

    const result = await client.query(clienteQuery, [dados.codigo_filial]);

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(result.rows));
  } catch (error: any) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

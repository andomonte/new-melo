import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { descricao } = req.query;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    if (
      !descricao ||
      typeof descricao !== 'string' ||
      descricao.trim() === ''
    ) {
      return res.status(200).json({ data: null });
    }

    const bairroResult = await client.query(
      `
        SELECT
          b.*,
          z.descr AS zona_descr,
          m.descricao AS municipio_nome,
          p.descricao AS pais_nome
        FROM dbbairro b
        LEFT JOIN dbzona z ON z.codzona = b.codzona
        LEFT JOIN dbmunicipio m ON m.codmunicipio = b.codmunicipio
        LEFT JOIN dbpais p ON p.codpais = b.codpais
        WHERE b.descr ILIKE $1
        ORDER BY b.descr
        LIMIT 1
      `,
      [`%${descricao}%`],
    );

    res
      .status(200)
      .json({ data: serializeBigInt(bairroResult.rows[0] ?? null) });
  } catch (error) {
    console.error('Erro ao buscar bairro:', (error as Error).message);
    res.status(500).json({ error: 'Erro ao buscar bairro' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

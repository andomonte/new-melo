import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Import your getPgPool function
import { serializeBigInt } from '@/utils/serializeBigInt'; // Keep if you need to serialize BigInts

export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERROR: BRANCH NOT PROVIDED IN COOKIE.');
    return res.status(400).json({ error: 'BRANCH NOT PROVIDED IN COOKIE' });
  }

  let client: PoolClient | undefined;
  const { codClient } = req.body; // 'codClient' comes from the request body

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const querySql = `
      SELECT
          MIN(dt_venc) AS dt_min
      FROM dbreceb             -- Table name in lowercase
      WHERE rec ILIKE $1         -- Column name in lowercase
        AND cancel ILIKE $2      -- Column name in lowercase
        AND codcli ILIKE $3;     -- Column name in lowercase
    `;

    // The parameters for the query
    // $1 for 'rec' (N), $2 for 'cancel' (N), $3 for 'codcli' (from req.body)
    const params = ['N', 'N', `${codClient}`];

    const COM_VENDA_Result = await client.query(querySql, params);

    const COM_VENDA_PostgreSQL = COM_VENDA_Result.rows;

    // Maps the results to ensure column names are in UPPERCASE
    const COM_VENDA_Formatado = COM_VENDA_PostgreSQL.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formattedItem);
    });

    res.status(200).json(COM_VENDA_Formatado);
  } catch (error) {
    console.error('UNEXPECTED ERROR IN API ROUTE:', error);
    res.status(500).json({ error: 'ERROR FETCHING RECEIVABLES DATA' });
  } finally {
    if (client) {
      client.release(); // RELEASES THE CONNECTION BACK TO THE POOL
    }
  }
}

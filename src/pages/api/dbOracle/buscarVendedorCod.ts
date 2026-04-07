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
  const { descricao } = req.body; // 'descricao' comes from the request body

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const querySql = `
      SELECT
        codvend,
        nome,
        valobj,
        comnormal,
        comtele,
        debito,
        credito,
        limite,
        status,
        codcv,
        comobj,
        valobjf,
        valobjm,
        valobjsf,
        ra_mat
      FROM dbvend  -- Table name in lowercase
      WHERE nome ILIKE $1 -- Case-insensitive search on nome
      OR codvend ILIKE $2; -- Case-insensitive search on codvend
    `;

    // Parameters for the query.  PostgreSQL uses $1, $2, etc.
    const params = [`${descricao.toUpperCase()}%`, `%${descricao}%`];

    const COM_VENDA_Result = await client.query(querySql, params);

    const COM_VENDA_PostgreSQL = COM_VENDA_Result.rows;

    // Maps the results to ensure column names are in UPPERCASE for the frontend.
    const COM_VENDA_Formatado = COM_VENDA_PostgreSQL.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          // Converts the PostgreSQL lowercase column names to UPPERCASE for the JSON output.
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formattedItem);
    });

    res.status(200).json(COM_VENDA_Formatado);
  } catch (error) {
    console.error('UNEXPECTED ERROR IN API ROUTE:', error);
    res.status(500).json({ error: 'ERROR FETCHING SALESPERSON DATA' });
  } finally {
    if (client) {
      client.release(); // RELEASES THE CONNECTION BACK TO THE POOL
    }
  }
}

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

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Query to get the row with the maximum codvenda, optimized for PostgreSQL
    const querySql = `
      SELECT
          operacao,
          codvenda,
          codusr,
          nrovenda,
          codcli,
          data,
          total,
          nronf,
          pedido,
          status,
          transp,
          prazo,
          obs,
          tipo_desc,
          tipo,
          tele,
          cancel,
          statusest,
          impresso,
          vlrfrete,
          codtptransp,
          bloqueada,
          estoque_virtual,
          numeroserie,
          numerocupom,
          obsfat,
          localentregacliente,
          codcv,
          codvend,
          comnormal,
          comobj,
          comtele,
          credito,
          debito,
          limite,
          nome,
          ra_mat,
          valobj,
          valobjf,
          valobjm,
          valobjsf
      FROM dbvenda           -- Table name in lowercase
      ORDER BY codvenda DESC -- Column name in lowercase for ordering
      LIMIT 1;               -- Efficiently gets only the top row (max codvenda)
    `;

    const COM_VENDA_Result = await client.query(querySql);

    const COM_VENDA_PostgreSQL = COM_VENDA_Result.rows;

    // Maps the results to ensure column names are in UPPERCASE
    const COM_VENDA_Formatado = COM_VENDA_PostgreSQL.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          // Converts the PostgreSQL lowercase column names to UPPERCASE for the JSON output
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formattedItem);
    });

    res.status(200).json(COM_VENDA_Formatado);
  } catch (error) {
    console.error('UNEXPECTED ERROR IN API ROUTE:', error);
    res.status(500).json({ error: 'ERROR FETCHING SALES DATA' });
  } finally {
    if (client) {
      client.release(); // RELEASES THE CONNECTION BACK TO THE POOL
    }
  }
}

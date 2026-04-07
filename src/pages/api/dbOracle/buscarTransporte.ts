import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Mantenha se precisar serializar BigInts

export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: FILIAL NÃO INFORMADA NO COOKIE.');
    return res.status(400).json({ error: 'FILIAL NÃO INFORMADA NO COOKIE' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const querySql = `
      SELECT
          codtptransp,
          descr
      FROM dbtptransp
      ORDER BY descr; -- Adicionada a ordenação pela coluna descr
    `;

    const COM_VENDA_Result = await client.query(querySql);

    const COM_VENDA_PostgreSQL = COM_VENDA_Result.rows;

    // Mapeia os resultados para garantir que os nomes das colunas estejam em CAIXA ALTA
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
    console.error('ERRO INESPERADO NO API ROUTE:', error);
    res.status(500).json({ error: 'ERRO AO BUSCAR DADOS DE TRANSPORTADORA' });
  } finally {
    if (client) {
      client.release(); // LIBERA A CONEXÃO DE VOLTA PARA O POOL
    }
  }
}

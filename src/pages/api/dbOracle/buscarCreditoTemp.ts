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
  const { codClient } = req.body; // 'codClient' vem do corpo da requisição

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const querySql = `
      SELECT
          c.codcli,
          c.limite,
          c.limite_usado,
          (c.limite - c.limite_usado) AS saldo
      FROM dbclien_creditotmp c
      WHERE c.status ILIKE $1
        AND c.codcli ILIKE $2;
    `;

    // No Oracle, 'letra' é 'A' fixo, vamos manter isso aqui.
    // O 'codClient' é o segundo parâmetro.
    const params = ['A', `${codClient}`];

    const COM_VENDA_Result = await client.query(querySql, params);

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
    res
      .status(500)
      .json({ error: 'ERRO AO BUSCAR DADOS DE CRÉDITO DO CLIENTE' });
  } finally {
    if (client) {
      client.release(); // LIBERA A CONEXÃO DE VOLTA PARA O POOL
    }
  }
}

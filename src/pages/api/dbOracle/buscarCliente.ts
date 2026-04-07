import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { descricao = '', pagina = 0, tamanhoPagina = 10 } = req.body;
  const offset = pagina * tamanhoPagina;

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Query paginada
    // Query paginada
    const result = await client.query(
      `SELECT c.*,
          (
            EXISTS (SELECT 1 FROM kickback k WHERE k.codcli = c.codcli)
            AND
            EXISTS (SELECT 1 FROM cliente_kickback ck WHERE ck.codcli = c.codcli)
          ) AS kickback
     FROM DBCLIEN c
    WHERE c.NOME ILIKE $1
       OR c.CPFCGC ILIKE $2
       OR c.CODCLI ILIKE $3
    ORDER BY c.NOME
    OFFSET $4 LIMIT $5`,
      [`${descricao}`, `${descricao}`, `${descricao}`, offset, tamanhoPagina],
    );

    // Total para paginação
    const totalQuery = await client.query(
      `SELECT COUNT(*) FROM DBCLIEN 
       WHERE NOME ILIKE $1 OR CPFCGC ILIKE $2 OR CODCLI ILIKE $3`,
      [`${descricao}`, `${descricao}`, `${descricao}`],
    );

    const dataFormatada = result.rows.map((item: Record<string, any>) => {
      const formatado: Record<string, any> = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          formatado[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formatado);
    });

    const total = Number(totalQuery.rows[0].count);

    res.status(200).json({ data: dataFormatada, total });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

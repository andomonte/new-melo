import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const { descricao } = req.body;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const COM_VENDA_Result = await client.query(
      `SELECT * FROM DBCLIEN WHERE NOME ILIKE $1 OR CPFCGC ILIKE $2 OR CODCLI ILIKE $3`,
      [`%${descricao}%`, `%${descricao}%`, `%${descricao}%`],
    );

    const COM_VENDA_PostgreSQL = COM_VENDA_Result.rows;

    // --- CÓDIGO PARA FORMATAR AS CHAVES PARA CAIXA ALTA ---
    const COM_VENDA_Formatado = COM_VENDA_PostgreSQL.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          // Converte o nome da chave para MAIÚSCULA
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      // Aplica serializeBigInt após a formatação das chaves
      return serializeBigInt(formattedItem);
    });
    // --- FIM DO CÓDIGO DE FORMATAÇÃO ---

    res.status(200).json(COM_VENDA_Formatado);
  } catch (error) {
    console.error('Erro ao buscar dados do cliente no PostgreSQL:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

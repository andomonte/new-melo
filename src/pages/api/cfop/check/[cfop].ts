// pages/api/cfop/check/[cfop].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// ✅ Padronizando o nome da tabela em uma constante para evitar erros
const TABLE_NAME = 'public."dbcfop_n"';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { cfop } = req.query;

  if (!cfop || typeof cfop !== 'string') {
    return res.status(400).json({ error: 'CFOP inválido na URL.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE "cfop" = $1`;
    const result = await client.query(query, [cfop]);

    const exists = parseInt(result.rows[0].count, 10) > 0;

    res.status(200).json({ exists });
  } catch (error: any) {
    console.error('Erro ao verificar CFOP:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) return res.status(400).json({ error: 'Filial não informada' });

  const { codprods, tipoPreco } = req.body ?? {};
  if (!Array.isArray(codprods) || codprods.length === 0) return res.status(200).json({ precos: {} });

  const tipo = String(tipoPreco || '0');
  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const placeholders = codprods.map((_: any, i: number) => `$${i + 2}`).join(',');
    const result = await client.query(
      `SELECT "CODPROD", "PRECOVENDA" FROM dbformacaoprvenda WHERE "TIPOPRECO" = $1 AND "CODPROD" IN (${placeholders})`,
      [tipo, ...codprods.map(String)]
    );

    const precos: Record<string, number> = {};
    result.rows.forEach((r: any) => {
      precos[r.CODPROD] = Number(r.PRECOVENDA) || 0;
    });

    return res.status(200).json({ precos });
  } catch (error) {
    console.error('Erro ao buscar preços:', error);
    return res.status(500).json({ error: 'Erro ao buscar preços' });
  } finally {
    if (client) client.release();
  }
}

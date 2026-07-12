import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const { page = '1', perPage = '10', search = '' } = req.query;
  const client = await getPgPool().connect();
  try {
    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const where = search
      ? `WHERE rf.referencia ILIKE $1 OR rf.codmarca ILIKE $1 OR COALESCE(m.descr,'') ILIKE $1`
      : '';
    const params: any[] = search ? [`%${search}%`] : [];
    const data = await client.query(
      `SELECT rf.cod_id, rf.referencia, rf.codmarca,
              CASE WHEN m.descr IS NOT NULL THEN rf.codmarca || ' - ' || m.descr ELSE rf.codmarca END AS marca,
              rf.codcredor
         FROM db_manaus.dbref_fabrica rf
         LEFT JOIN db_manaus.dbmarcas m ON m.codmarca = rf.codmarca
         ${where}
        ORDER BY rf.referencia LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const count = await client.query(
      `SELECT COUNT(*) AS total FROM db_manaus.dbref_fabrica rf
         LEFT JOIN db_manaus.dbmarcas m ON m.codmarca = rf.codmarca ${where}`,
      params,
    );
    const total = parseInt(count.rows[0].total, 10);
    res.status(200).json({
      data: serializeBigInt(data.rows),
      meta: { total, lastPage: total > 0 ? Math.ceil(total / limit) : 1, currentPage: Number(page), perPage: limit },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const { page = '1', perPage = '10', search = '' } = req.query;
  const client = await getPgPool().connect();
  try {
    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const where = search ? `WHERE ncm ILIKE $1 OR descricao ILIKE $1` : '';
    const params: any[] = search ? [`%${search}%`] : [];
    const data = await client.query(
      `SELECT id, ncm, ipi, pis, cofins, agregado, descricao
         FROM db_manaus.dbclassificacao_fiscal ${where}
        ORDER BY ncm LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const count = await client.query(
      `SELECT COUNT(*) AS total FROM db_manaus.dbclassificacao_fiscal ${where}`,
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

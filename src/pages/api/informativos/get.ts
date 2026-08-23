import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const { page = '1', perPage = '10', search = '' } = req.query;
  const client = await getPgPool().connect();
  try {
    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const where = search
      ? `WHERE simbolo ILIKE $1 OR descr ILIKE $1`
      : '';
    const params: any[] = search ? [`%${search}%`] : [];
    const data = await client.query(
      `SELECT simbolo, descr FROM dbinformativo ${where} ORDER BY simbolo LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const count = await client.query(
      `SELECT COUNT(*) AS total FROM dbinformativo ${where}`,
      params,
    );
    const total = parseInt(count.rows[0].total, 10);
    res.status(200).json({
      data: data.rows,
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / limit) : 1,
        currentPage: Number(page),
        perPage: limit,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const ncm = String(req.body?.ncm ?? '').trim();
  if (!ncm) return res.status(400).json({ error: 'NCM é obrigatório.' });
  if (!/^\d{8}$/.test(ncm)) return res.status(400).json({ error: 'NCM deve ter 8 dígitos.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const maxRes = await client.query('SELECT COALESCE(MAX(id),0)+1 AS next_id FROM dbclassificacao_fiscal');
    const id = maxRes.rows[0].next_id;
    const r = await client.query(
      `INSERT INTO dbclassificacao_fiscal (id, ncm, ipi, pis, cofins, agregado, descricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, ncm, ipi, pis, cofins, agregado, descricao`,
      [id, ncm, num(req.body?.ipi), num(req.body?.pis), num(req.body?.cofins), num(req.body?.agregado), String(req.body?.descricao ?? '').trim().toUpperCase() || null],
    );
    await client.query('COMMIT');
    res.status(201).json({ data: serializeBigInt(r.rows[0]) });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

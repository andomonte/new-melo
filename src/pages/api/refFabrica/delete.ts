import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });
  const cod_id = req.query.cod_id ?? req.body?.cod_id;
  if (!cod_id) return res.status(400).json({ error: 'Código é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    // remove vínculos com produtos e a referência
    await client.query('DELETE FROM db_manaus.dbprod_ref_fabrica WHERE cod_id = $1', [cod_id]);
    const r = await client.query('DELETE FROM db_manaus.dbref_fabrica WHERE cod_id = $1', [cod_id]);
    await client.query('COMMIT');
    if (!r.rowCount) return res.status(404).json({ error: 'Referência não encontrada.' });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

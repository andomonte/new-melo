import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });
  const id = req.query.id ?? req.body?.id;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query('DELETE FROM dbclassificacao_fiscal WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Classificação não encontrada.' });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

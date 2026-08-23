import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  const simbolo = String(req.body?.simbolo ?? '').trim();
  const descr = String(req.body?.descr ?? '').trim().toUpperCase();
  if (!simbolo || !descr) return res.status(400).json({ error: 'Símbolo e descrição são obrigatórios.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query('UPDATE dbinformativo SET descr = $2 WHERE simbolo = $1', [simbolo, descr]);
    if (!r.rowCount) return res.status(404).json({ error: 'Informativo não encontrado.' });
    res.status(200).json({ data: { simbolo, descr } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  const codgpf = String(req.body?.codgpf ?? '').trim();
  const descr = String(req.body?.descr ?? '').trim().toUpperCase();
  if (!codgpf || !descr) return res.status(400).json({ error: 'Código e descrição são obrigatórios.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query('UPDATE db_manaus.dbgpfunc SET descr = $2 WHERE codgpf = $1', [codgpf, descr]);
    if (!r.rowCount) return res.status(404).json({ error: 'Grupo de função não encontrado.' });
    res.status(200).json({ data: { codgpf, descr } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

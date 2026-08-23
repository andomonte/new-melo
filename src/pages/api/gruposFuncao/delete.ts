import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });
  const codgpf = String(req.query.codgpf ?? req.body?.codgpf ?? '').trim();
  if (!codgpf) return res.status(400).json({ error: 'Código é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    // Não permite excluir se houver produtos usando este grupo de função
    const uso = await client.query('SELECT 1 FROM dbprod WHERE codgpf = $1 LIMIT 1', [codgpf]);
    if (uso.rowCount)
      return res.status(400).json({ error: 'Não é possível excluir: há produtos usando este grupo de função.' });
    const r = await client.query('DELETE FROM dbgpfunc WHERE codgpf = $1', [codgpf]);
    if (!r.rowCount) return res.status(404).json({ error: 'Grupo de função não encontrado.' });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

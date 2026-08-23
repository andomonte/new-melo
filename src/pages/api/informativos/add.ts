import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const simbolo = String(req.body?.simbolo ?? '').trim();
  const descr = String(req.body?.descr ?? '').trim().toUpperCase();
  if (!simbolo) return res.status(400).json({ error: 'Símbolo é obrigatório.' });
  if (!descr) return res.status(400).json({ error: 'Descrição é obrigatória.' });
  if (simbolo.length > 2) return res.status(400).json({ error: 'Símbolo deve ter no máximo 2 caracteres.' });

  const client = await getPgPool().connect();
  try {
    const existe = await client.query('SELECT 1 FROM dbinformativo WHERE simbolo = $1', [simbolo]);
    if (existe.rowCount) return res.status(409).json({ error: `Já existe o informativo "${simbolo}".` });
    await client.query('INSERT INTO dbinformativo (simbolo, descr) VALUES ($1, $2)', [simbolo, descr]);
    res.status(201).json({ data: { simbolo, descr } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

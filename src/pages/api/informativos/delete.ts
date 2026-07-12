import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// Informativos com regra de sistema não podem ser excluídos
const PROTEGIDOS = ['*', '-', 'D', 'E', 'L', 'N', 'S'];

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });
  const simbolo = String(req.query.simbolo ?? req.body?.simbolo ?? '').trim();
  if (!simbolo) return res.status(400).json({ error: 'Símbolo é obrigatório.' });
  if (PROTEGIDOS.includes(simbolo))
    return res.status(400).json({ error: `O informativo "${simbolo}" é padrão do sistema e não pode ser excluído.` });

  const client = await getPgPool().connect();
  try {
    const r = await client.query('DELETE FROM db_manaus.dbinformativo WHERE simbolo = $1', [simbolo]);
    if (!r.rowCount) return res.status(404).json({ error: 'Informativo não encontrado.' });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

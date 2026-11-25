import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { cancelarNotaServico, NfsValidacaoError } from '@/lib/nfse/notasServico';

/** Cancela a nota e os títulos (bloqueia se algum título já tiver recebimento). POST { motivo, usuario? } */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const codfat = String(req.query.codfat || '').trim();
  const { motivo, usuario } = req.body || {};
  if (!String(motivo || '').trim()) return res.status(400).json({ erro: 'Informe o motivo do cancelamento.' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await cancelarNotaServico(db, codfat, usuario || parseCookies({ req }).userName || 'Sistema', motivo);
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao cancelar nota de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao cancelar a nota', detalhes: e?.message });
  } finally {
    db.release();
  }
}

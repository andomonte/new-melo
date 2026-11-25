import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { NfsValidacaoError } from '@/lib/nfse/notasServico';
import { emitirNotaServico } from '@/lib/nfse/sefin/emissao';

/**
 * Emite a NFS-e pela Sefin Nacional. POST { nota, cobranca? }
 * Tudo numa transação: se a Sefin rejeitar, nada fica gravado (nem o nº da DPS).
 * Ambiente: NFSE_SEFIN_AMBIENTE (RESTRITA por padrão = testes do governo, sem valor fiscal).
 */
const pool = getPgPool();
export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { nota, cobranca, usuario } = req.body || {};
  if (!nota) return res.status(400).json({ erro: 'Dados da nota não informados.' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await emitirNotaServico(db, nota, { cobranca: cobranca || null, usuario: usuario || parseCookies({ req }).userName || null });
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao emitir NFS-e:', e);
    return res.status(500).json({ erro: e?.message || 'Erro ao emitir a NFS-e' });
  } finally {
    db.release();
  }
}

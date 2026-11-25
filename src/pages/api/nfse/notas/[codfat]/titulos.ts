import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { gerarTitulosNfs, NfsValidacaoError } from '@/lib/nfse/notasServico';

/** Gera os títulos a receber de uma nota sem cobrança. POST { banco, forma?, prazos: number[] } */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const codfat = String(req.query.codfat || '').trim();
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await gerarTitulosNfs(db, codfat, req.body || {});
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao gerar títulos da nota de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao gerar os títulos', detalhes: e?.message });
  } finally {
    db.release();
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { gerarTituloTomada, TomadaValidacaoError } from '@/lib/nfse/tomadas';

/**
 * Gera o título a pagar da NFS-e tomada (manual).
 * POST { cod_credor, pag_cof_id?, cod_conta?, cod_ccusto?, parcelas: [{ dt_venc, valor }], obs?, usuario? }
 * Soma das parcelas = líquido da nota.
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const body = req.body || {};
  const quem = body.usuario || parseCookies({ req }).userName || 'Sistema';
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await gerarTituloTomada(db, String(req.query.id || ''), body, quem);
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof TomadaValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao gerar título da NFS-e tomada:', e);
    return res.status(500).json({ erro: 'Erro ao gerar o título a pagar', detalhes: e?.message });
  } finally {
    db.release();
  }
}

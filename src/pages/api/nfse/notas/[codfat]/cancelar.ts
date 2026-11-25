import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { cancelarNotaServico, NfsValidacaoError } from '@/lib/nfse/notasServico';
import { cancelarNfseNoPortal } from '@/lib/nfse/sefin/emissao';

/**
 * Cancela a nota e os títulos (bloqueia se algum título já tiver recebimento). POST { motivo, cMotivo?, usuario? }
 * Nota nacional emitida pela empresa (origem EMITIDA ou NACIONAL, com chave): cancela PRIMEIRO no portal
 * (evento 101101; cMotivo 1 erro na emissão · 2 serviço não prestado · 9 outros), depois localmente.
 */
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
    const quem = usuario || parseCookies({ req }).userName || 'Sistema';
    const n = (await db.query(`SELECT origem, chave_acesso FROM nfs_nota WHERE codfat = $1`, [codfat])).rows[0];
    const noPortal = !!n && ['EMITIDA', 'NACIONAL'].includes(n.origem) && String(n.chave_acesso || '').length === 50;
    const r = noPortal
      ? await cancelarNfseNoPortal(db, codfat, (['1', '2', '9'].includes(String(req.body?.cMotivo)) ? String(req.body.cMotivo) : '1') as '1' | '2' | '9', motivo, quem)
      : await cancelarNotaServico(db, codfat, quem, motivo);
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, noPortal, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao cancelar nota de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao cancelar a nota', detalhes: e?.message });
  } finally {
    db.release();
  }
}

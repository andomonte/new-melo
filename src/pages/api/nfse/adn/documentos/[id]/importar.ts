import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { importarDocumentoAdn } from '@/lib/nfse/adn/distribuicao';
import { NfsValidacaoError } from '@/lib/nfse/notasServico';

/** Importa a NFS-e prestada do ADN para as Notas de Serviço. POST { codcli?, sen_id?, cobranca? } */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const id = Number(req.query.id);
  const { codcli, sen_id, cobranca, usuario } = req.body || {};
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await importarDocumentoAdn(db, id, { codcli, sen_id, cobranca }, usuario || parseCookies({ req }).userName || null);
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao importar documento do ADN:', e);
    return res.status(500).json({ erro: 'Erro ao importar a nota', detalhes: e?.message });
  } finally {
    db.release();
  }
}

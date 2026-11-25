import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { sincronizarAdn } from '@/lib/nfse/adn/distribuicao';

/** Busca no ADN as NFS-e novas desde o último NSU (POST). Faz chamadas externas; cada documento é gravado ao chegar. */
const pool = getPgPool();
export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const db = await pool.connect();
  try {
    const r = await sincronizarAdn(db, { cnpj: req.body?.cnpj || null });
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    console.error('Erro na busca do ADN:', e);
    return res.status(502).json({ erro: e?.message || 'Erro na busca do ADN' });
  } finally {
    db.release();
  }
}

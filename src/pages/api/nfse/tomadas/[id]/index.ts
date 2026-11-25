import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { detalheTomada, TomadaValidacaoError } from '@/lib/nfse/tomadas';

/** Detalhe da nota tomada: dados, retenções lidas do XML e títulos a pagar já gerados. */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  try {
    return res.status(200).json(await detalheTomada(pool, String(req.query.id || '')));
  } catch (e: any) {
    if (e instanceof TomadaValidacaoError) return res.status(404).json({ erro: e.message });
    console.error('Erro ao carregar NFS-e tomada:', e);
    return res.status(500).json({ erro: 'Erro ao carregar a nota tomada' });
  }
}

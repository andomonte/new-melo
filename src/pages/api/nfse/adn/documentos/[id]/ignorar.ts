import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { ignorarDocumentoAdn } from '@/lib/nfse/adn/distribuicao';
import { NfsValidacaoError } from '@/lib/nfse/notasServico';

/** Tira a nota da lista de conferência sem importar. POST */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  try {
    await ignorarDocumentoAdn(pool, Number(req.query.id), req.body?.usuario || parseCookies({ req }).userName || null);
    return res.status(200).json({ sucesso: true });
  } catch (e: any) {
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao ignorar documento do ADN:', e);
    return res.status(500).json({ erro: 'Erro ao ignorar' });
  }
}

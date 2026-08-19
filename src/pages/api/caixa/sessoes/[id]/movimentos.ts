import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { listarMovimentos, schemaDaFilial } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/** GET /api/caixa/sessoes/[id]/movimentos?filial=  → extrato da sessão. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const schema = schemaDaFilial(String(req.query.filial || ''));
    const movimentos = await listarMovimentos(client, schema, Number(req.query.id));
    return res.status(200).json({ movimentos });
  } catch (error: any) {
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

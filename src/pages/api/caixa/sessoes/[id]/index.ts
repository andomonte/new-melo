import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getSessao, calcularSaldos, schemaDaFilial } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/** GET /api/caixa/sessoes/[id]?filial=  → detalhe da sessão + saldos. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const schema = schemaDaFilial(String(req.query.filial || ''));
    const id = Number(req.query.id);
    const sessao = await getSessao(client, schema, id);
    const saldos = await calcularSaldos(client, schema, sessao);
    return res.status(200).json({ sessao, ...saldos });
  } catch (error: any) {
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

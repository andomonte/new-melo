import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { sessaoAtual, calcularSaldos, schemaDaFilial } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * GET /api/caixa/sessoes/atual?filial=&cod_conta=
 * Sessão ABERTO/EM_FECHAMENTO da conta (ou {sessao:null}), com saldos.
 * Usado no boot do PDV para retomar sessão (ex.: após queda de energia).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const schema = schemaDaFilial(String(req.query.filial || ''));
    const sessao = await sessaoAtual(client, schema, String(req.query.cod_conta || ''));
    if (!sessao) return res.status(200).json({ sessao: null });
    const saldos = await calcularSaldos(client, schema, sessao);
    return res.status(200).json({ sessao, ...saldos });
  } catch (error: any) {
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

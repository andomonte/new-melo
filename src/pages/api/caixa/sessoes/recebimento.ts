import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { registrarRecebimentoNaSessao } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * POST /api/caixa/sessoes/recebimento
 *   body: { filial, cod_conta, operador, movimentos:[{forma_pagamento,valor,referencia?}] }
 * Registra os movimentos de RECEBIMENTO na sessão ABERTA da conta (UC-04).
 * Gate desligado: se não houver sessão aberta, retorna {sessao:null} sem erro — o fluxo
 * atual do recebimento não quebra. É chamado logo após a baixa real do título.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const b = req.body || {};
  if (!b.filial || !b.cod_conta || !Array.isArray(b.movimentos)) {
    return res.status(400).json({ erro: 'Obrigatórios: filial, cod_conta, movimentos[].' });
  }
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessao = await registrarRecebimentoNaSessao(client, {
      filial: b.filial,
      cod_conta: b.cod_conta,
      operador: b.operador,
      movimentos: b.movimentos,
      exigirCaixaAberto: false,
    });
    await client.query('COMMIT');
    return res.status(200).json({ sucesso: true, sessao });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

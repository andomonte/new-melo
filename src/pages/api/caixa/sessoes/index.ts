import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { abrirCaixa, sessaoAtual, calcularSaldos, schemaDaFilial } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * POST /api/caixa/sessoes            → abrir caixa (UC-01)
 *   body: { filial, cod_conta, operador, fundo_troco, observacao? }
 * GET  /api/caixa/sessoes/atual?filial=&cod_conta=  → ver rota atual.ts
 * GET  /api/caixa/sessoes?filial=&cod_conta=         → sessão aberta da conta (+ saldos)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const filial = String(req.query.filial || '');
      const codConta = String(req.query.cod_conta || '');
      const schema = schemaDaFilial(filial);
      const sessao = await sessaoAtual(client, schema, codConta);
      if (!sessao) return res.status(200).json({ sessao: null });
      const saldos = await calcularSaldos(client, schema, sessao);
      return res.status(200).json({ sessao, ...saldos });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.filial || !b.cod_conta || !b.operador) {
        return res.status(400).json({ erro: 'Obrigatórios: filial, cod_conta, operador.' });
      }
      await client.query('BEGIN');
      const sessao = await abrirCaixa(client, {
        filial: b.filial,
        cod_conta: b.cod_conta,
        operador: b.operador,
        fundo_troco: Number(b.fundo_troco || 0),
        observacao: b.observacao,
      });
      await client.query('COMMIT');
      return res.status(201).json({ sucesso: true, sessao });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getSessao, listarMovimentos, calcularSaldos, schemaDaFilial } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/** GET /api/caixa/sessoes/[id]/relatorio?filial=  → relatório de fechamento (seção 10). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const schema = schemaDaFilial(String(req.query.filial || ''));
    const id = Number(req.query.id);
    const sessao = await getSessao(client, schema, id);
    const movimentos = await listarMovimentos(client, schema, id);
    const saldos = await calcularSaldos(client, schema, sessao);
    const ff = await client.query(
      `SELECT forma_pagamento, valor_esperado, valor_informado, diferenca
         FROM ${schema}.caixa_fechamento_forma WHERE sessao_id=$1 ORDER BY forma_pagamento`,
      [id],
    );

    const recebimentos = movimentos.filter((m: any) => m.tipo === 'RECEBIMENTO');
    const totalReceb = recebimentos.reduce((s: number, m: any) => s + Number(m.valor), 0);
    const sangrias = movimentos.filter((m: any) => m.tipo === 'SANGRIA');
    const suprimentos = movimentos.filter((m: any) => m.tipo === 'SUPRIMENTO');

    return res.status(200).json({
      cabecalho: {
        filial: sessao.filial,
        cod_conta: sessao.cod_conta,
        operador_abertura: sessao.operador_abertura,
        operador_fechamento: sessao.operador_fechamento,
        aberto_em: sessao.aberto_em,
        fechado_em: sessao.fechado_em,
        status: sessao.status,
        fechamento_forcado: sessao.fechamento_forcado,
      },
      fundo_troco: sessao.fundo_troco,
      totais_por_forma: saldos.totaisPorForma,
      conferencia_formas: ff.rows,
      recebimentos: {
        total: Math.round((totalReceb + Number.EPSILON) * 100) / 100,
        quantidade: recebimentos.length,
        ticket_medio: recebimentos.length ? Math.round((totalReceb / recebimentos.length + Number.EPSILON) * 100) / 100 : 0,
      },
      sangrias,
      suprimentos,
      saldo_esperado_dinheiro: sessao.saldo_esperado_dinheiro ?? saldos.saldoDinheiro,
      saldo_informado_dinheiro: sessao.saldo_informado_dinheiro,
      quebra: sessao.quebra,
    });
  } catch (error: any) {
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

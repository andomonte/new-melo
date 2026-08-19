import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { iniciarFechamento, confirmarFechamento, cancelarFechamento } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * Fechamento em duas fases (UC-05/06/07):
 *   POST   → inicia (congela snapshot). body: { filial }
 *   PUT    → confirma. body: { filial, operador, saldo_informado_dinheiro, valores_por_forma?, observacao? }
 *   DELETE → cancela (volta a ABERTO). body: { filial }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const b = req.body || {};
  const filial = b.filial || (req.query.filial as string);
  const id = Number(req.query.id);
  if (!filial) return res.status(400).json({ erro: 'Obrigatório: filial.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'POST') {
      await client.query('BEGIN');
      const r = await iniciarFechamento(client, filial, id);
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, ...r });
    }
    if (req.method === 'PUT') {
      if (!b.operador) return res.status(400).json({ erro: 'Obrigatório: operador.' });
      await client.query('BEGIN');
      const r = await confirmarFechamento(client, {
        filial,
        sessao_id: id,
        operador: b.operador,
        saldo_informado_dinheiro: Number(b.saldo_informado_dinheiro),
        valores_por_forma: b.valores_por_forma,
        observacao: b.observacao,
      });
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, ...r });
    }
    if (req.method === 'DELETE') {
      await client.query('BEGIN');
      const sessao = await cancelarFechamento(client, filial, id);
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, sessao });
    }
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

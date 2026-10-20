import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { editarMovimento, excluirMovimento } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * PUT    /api/caixa/sessoes/[id]/movimentos/[movId]  → edita valor/motivo de sangria|suprimento
 *   body: { filial, operador?, valor, motivo }
 * DELETE /api/caixa/sessoes/[id]/movimentos/[movId]  → remove a sangria|suprimento
 *   body: { filial, operador? }
 * Só enquanto a sessão está ABERTA; os demais tipos (abertura/recebimento) não são editáveis.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessaoId = Number(req.query.id);
  const movId = Number(req.query.movId);
  const b = req.body || {};
  const filial = String(b.filial || req.query.filial || '');
  if (!filial) return res.status(400).json({ erro: 'Obrigatório: filial.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'PUT') {
      await client.query('BEGIN');
      const movimento = await editarMovimento(client, {
        filial,
        sessao_id: sessaoId,
        movimento_id: movId,
        operador: b.operador,
        valor: Number(b.valor),
        motivo: b.motivo,
      });
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, movimento });
    }
    if (req.method === 'DELETE') {
      await client.query('BEGIN');
      await excluirMovimento(client, {
        filial,
        sessao_id: sessaoId,
        movimento_id: movId,
        operador: b.operador,
      });
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true });
    }
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { registrarSuprimento } from '@/lib/caixa/sessaoCaixa';
import { responderErroCaixa } from '@/lib/caixa/apiCaixa';

/**
 * POST /api/caixa/sessoes/[id]/suprimentos  (UC-03)
 *   body: { filial, operador, valor, motivo }
 *   header opcional: Idempotency-Key
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const b = req.body || {};
  if (!b.filial || !b.operador) return res.status(400).json({ erro: 'Obrigatórios: filial, operador.' });
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const movimento = await registrarSuprimento(client, {
      sessao_id: Number(req.query.id),
      filial: b.filial,
      operador: b.operador,
      valor: Number(b.valor),
      motivo: b.motivo,
      idempotency_key: (req.headers['idempotency-key'] as string) || b.idempotency_key,
    });
    await client.query('COMMIT');
    return res.status(201).json({ sucesso: true, movimento });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return responderErroCaixa(res, error);
  } finally {
    client.release();
  }
}

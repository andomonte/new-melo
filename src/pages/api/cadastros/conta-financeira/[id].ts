import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * PUT   /api/cadastros/conta-financeira/[id]  { cof_descricao, cof_cec_id?, cof_operacional? } → atualiza.
 * PATCH /api/cadastros/conta-financeira/[id]  { status: 'ativo'|'inativo' }                    → ativa/inativa.
 *
 * Não há DELETE: fiel ao padrão do sistema, a conta é INATIVADA (status), nunca excluída.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'PUT') {
      const { cof_descricao, cof_cec_id, cof_operacional } = req.body || {};
      if (!cof_descricao || !String(cof_descricao).trim()) {
        return res.status(400).json({ error: 'Informe a descrição.' });
      }
      const r = await client.query(
        `UPDATE cad_conta_financeira
            SET cof_descricao = $2, cof_cec_id = $3, cof_operacional = $4
          WHERE cof_id = $1`,
        [
          id,
          String(cof_descricao).trim().toUpperCase(),
          cof_cec_id ? Number(cof_cec_id) : null,
          cof_operacional === 'N' ? 'N' : 'S',
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
      return res.status(200).json({ sucesso: true });
    }

    if (req.method === 'PATCH') {
      const status = String(req.body?.status || '');
      if (status !== 'ativo' && status !== 'inativo') {
        return res.status(400).json({ error: "status deve ser 'ativo' ou 'inativo'." });
      }
      const r = await client.query(
        `UPDATE cad_conta_financeira SET status = $2 WHERE cof_id = $1`,
        [id, status],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
      return res.status(200).json({ sucesso: true, status });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error: any) {
    console.error('Erro ao atualizar conta financeira:', error);
    return res.status(500).json({ error: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

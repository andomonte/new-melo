import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/transferencia/excluir-venda  { codvenda }
 * Remove a VENDA de transferência (dbvenda + dbitvenda) — usado na compensação quando o
 * faturamento/NF falha (a venda de transferência é descartável, não faturada de fato).
 * Só exclui vendas SEM fatura ativa (segurança).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const codvenda = String(req.body?.codvenda || '').trim();
  if (!codvenda) return res.status(400).json({ erro: 'Informe codvenda.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const fat = await client.query(
      `SELECT 1 FROM db_manaus.fatura_venda WHERE codvenda=$1 AND status='ativo' LIMIT 1`,
      [codvenda],
    );
    if (fat.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Venda tem fatura ativa — não pode ser excluída.' });
    }
    await client.query(`DELETE FROM db_manaus.dbitvenda WHERE codvenda=$1`, [codvenda]);
    const d = await client.query(`DELETE FROM db_manaus.dbvenda WHERE codvenda=$1`, [codvenda]);
    await client.query('COMMIT');
    return res.status(200).json({ sucesso: true, removida: (d.rowCount ?? 0) > 0 });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ erro: 'Erro ao excluir venda', detalhes: error.message });
  } finally {
    client.release();
  }
}

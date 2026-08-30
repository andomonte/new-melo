import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * PUT   /api/cadastros/forma-pagamento/[codfpgt]  { descricao }            → atualiza descrição.
 * PATCH /api/cadastros/forma-pagamento/[codfpgt]  { status: ativo|inativo } → ativa/inativa.
 *
 * Sem DELETE: fiel ao padrão do sistema, a forma é INATIVADA (status), nunca excluída.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const codfpgt = String(req.query.codfpgt || '').trim();
  if (!codfpgt) return res.status(400).json({ error: 'Código inválido.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'PUT') {
      const descricao = String(req.body?.descricao || '').trim();
      if (!descricao) return res.status(400).json({ error: 'Informe a descrição.' });
      const r = await client.query(
        `UPDATE dbforma_pagto SET descricao = $2 WHERE codfpgt = $1`,
        [codfpgt, descricao.toUpperCase()],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Forma não encontrada.' });
      return res.status(200).json({ sucesso: true });
    }

    if (req.method === 'PATCH') {
      const status = String(req.body?.status || '');
      if (status !== 'ativo' && status !== 'inativo') {
        return res.status(400).json({ error: "status deve ser 'ativo' ou 'inativo'." });
      }
      const r = await client.query(`UPDATE dbforma_pagto SET status = $2 WHERE codfpgt = $1`, [codfpgt, status]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Forma não encontrada.' });
      return res.status(200).json({ sucesso: true, status });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error: any) {
    console.error('Erro ao atualizar forma de pagamento:', error);
    return res.status(500).json({ error: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

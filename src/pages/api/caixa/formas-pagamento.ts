import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Formas de pagamento do Caixa — lidas da tabela REAL do Delphi `dbforma_pagto`
 * (a SP FORMA_PAGAMENTO do SysCaixa faz `SELECT * FROM dbforma_pagto ORDER BY codfpgt`).
 * Retornamos TODAS as formas (igual ao combo do SysCaixa).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT codfpgt, descricao FROM dbforma_pagto ORDER BY codfpgt`,
    );
    return res.status(200).json({ formas: r.rows });
  } catch (error: any) {
    console.error('Erro ao listar formas de pagamento:', error);
    return res.status(500).json({ erro: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

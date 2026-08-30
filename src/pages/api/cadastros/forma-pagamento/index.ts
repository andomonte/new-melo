import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Cadastro de Forma de Pagamento (dbforma_pagto).
 *
 * GET  ?search=&status=todos|ativo|inativo → lista.
 * POST { codfpgt, descricao } → cria (codfpgt é o código, 2 dígitos; status 'ativo').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || 'todos');
      const params: any[] = [];
      let where = 'WHERE 1=1';
      if (status === 'ativo' || status === 'inativo') {
        params.push(status);
        where += ` AND COALESCE(status,'ativo') = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (CAST(codfpgt AS TEXT) LIKE $${params.length} OR UPPER(descricao) LIKE UPPER($${params.length}))`;
      }
      const r = await client.query(
        `SELECT codfpgt, descricao, COALESCE(status,'ativo') AS status
           FROM dbforma_pagto ${where} ORDER BY codfpgt`,
        params,
      );
      return res.status(200).json({ formas: r.rows });
    }

    if (req.method === 'POST') {
      const codfpgt = String(req.body?.codfpgt || '').trim().padStart(2, '0');
      const descricao = String(req.body?.descricao || '').trim();
      if (!/^\d{2}$/.test(codfpgt)) return res.status(400).json({ error: 'Código deve ter 2 dígitos.' });
      if (!descricao) return res.status(400).json({ error: 'Informe a descrição.' });
      const ex = await client.query(`SELECT 1 FROM dbforma_pagto WHERE codfpgt = $1`, [codfpgt]);
      if (ex.rows.length) return res.status(409).json({ error: `Já existe a forma de código ${codfpgt}.` });
      await client.query(
        `INSERT INTO dbforma_pagto (codfpgt, descricao, status) VALUES ($1, $2, 'ativo')`,
        [codfpgt, descricao.toUpperCase()],
      );
      return res.status(201).json({ sucesso: true, codfpgt });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error: any) {
    console.error('Erro no cadastro de forma de pagamento:', error);
    return res.status(500).json({ error: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

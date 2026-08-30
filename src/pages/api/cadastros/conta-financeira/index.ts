import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Cadastro de Conta Financeira (cad_conta_financeira).
 *
 * GET  ?centros=1                 → lista os centros de custo (para o form).
 * GET  ?search=&status=todos|ativo|inativo → lista as contas (default: todas).
 * POST { cof_descricao, cof_cec_id?, cof_operacional? } → cria (cof_id = MAX+1, status 'ativo').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      // Opções de centro de custo para o formulário.
      if (req.query.centros) {
        const cc = await client.query(
          `SELECT cec_id, cec_descricao FROM cad_centro_custo ORDER BY cec_descricao`,
        );
        return res.status(200).json({ centros: cc.rows });
      }

      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || 'todos');
      const params: any[] = [];
      let where = 'WHERE 1=1';
      if (status === 'ativo' || status === 'inativo') {
        params.push(status);
        where += ` AND COALESCE(cf.status,'ativo') = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (CAST(cf.cof_id AS TEXT) LIKE $${params.length} OR UPPER(cf.cof_descricao) LIKE UPPER($${params.length}))`;
      }
      const r = await client.query(
        `SELECT cf.cof_id, cf.cof_descricao, cf.cof_cec_id, cf.cof_operacional,
                COALESCE(cf.status,'ativo') AS status,
                cc.cec_descricao AS centro_custo
           FROM cad_conta_financeira cf
           LEFT JOIN cad_centro_custo cc ON cc.cec_id = cf.cof_cec_id
           ${where}
          ORDER BY cf.cof_id
          LIMIT 1000`,
        params,
      );
      return res.status(200).json({ contas: r.rows });
    }

    if (req.method === 'POST') {
      const { cof_descricao, cof_cec_id, cof_operacional } = req.body || {};
      if (!cof_descricao || !String(cof_descricao).trim()) {
        return res.status(400).json({ error: 'Informe a descrição.' });
      }
      const mx = await client.query(`SELECT COALESCE(MAX(cof_id),0) + 1 AS prox FROM cad_conta_financeira`);
      const cofId = mx.rows[0].prox;
      await client.query(
        `INSERT INTO cad_conta_financeira (cof_id, cof_descricao, cof_cec_id, cof_operacional, status)
         VALUES ($1, $2, $3, $4, 'ativo')`,
        [
          cofId,
          String(cof_descricao).trim().toUpperCase(),
          cof_cec_id ? Number(cof_cec_id) : null,
          cof_operacional === 'N' ? 'N' : 'S',
        ],
      );
      return res.status(201).json({ sucesso: true, cof_id: cofId });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error: any) {
    console.error('Erro no cadastro de conta financeira:', error);
    return res.status(500).json({ error: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

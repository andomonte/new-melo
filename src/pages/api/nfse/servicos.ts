import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/** Serviços ativos do cadastro (dbservico_nfs) para o campo de busca da nota: { value, label, ... } */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  const termo = String(req.query.search || '').trim();
  try {
    const r = await pool.query(
      `SELECT sen_id AS value, (sen_codigo || ' - ' || sen_atividade) AS label, sen_codigo, sen_cnae,
              sen_atividade, COALESCE(sen_issqn,0)::float AS sen_issqn
         FROM dbservico_nfs
        WHERE COALESCE(sen_excluido,0) = 0
          AND ($1 = '' OR sen_codigo ILIKE $1 || '%' OR sen_atividade ILIKE '%' || $1 || '%' OR sen_cnae ILIKE $1 || '%')
        ORDER BY sen_codigo, sen_atividade LIMIT 50`, [termo]);
    return res.status(200).json({ servicos: r.rows });
  } catch (e: any) {
    console.error('Erro ao listar serviços:', e);
    return res.status(500).json({ erro: 'Erro ao listar serviços' });
  }
}

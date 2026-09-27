// GET /api/locacoes/armazens — lista armazéns para a tela de Locações do Produto
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    const r = await pool.query(
      `SELECT arm_id, arm_descricao FROM db_manaus.cad_armazem
       WHERE COALESCE(arm_status,'A') <> 'I'
       ORDER BY arm_id`,
    );
    return res.status(200).json({ armazens: r.rows });
  } catch (error: any) {
    console.error('Erro ao listar armazéns:', error);
    return res.status(500).json({ error: 'Erro ao listar armazéns', message: error.message });
  }
}

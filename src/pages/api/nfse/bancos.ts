import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/** Bancos de cobrança ativos (dbbanco_cobranca 1..9) para a cobrança da nota de serviço. 5 = MELO. */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  try {
    const r = await pool.query(
      `SELECT banco, nome FROM dbbanco_cobranca
        WHERE banco ~ '^[1-9]$' AND COALESCE(status,'ativo') = 'ativo'
        ORDER BY (banco = '5') DESC, nome`);
    return res.status(200).json({ bancos: r.rows });
  } catch (e: any) {
    console.error('Erro ao listar bancos de cobrança:', e);
    return res.status(500).json({ erro: 'Erro ao listar bancos' });
  }
}

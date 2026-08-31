import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

/**
 * GET /api/contas-receber/dbcontas?search=  → contas (dbconta) para o filtro dos relatórios.
 * A "Conta" do relatório é o dbreceb.cod_conta (tabela dbconta: cod_conta → nro_conta),
 * NÃO a conta financeira. Busca por código ou nome.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  try {
    const search = String(req.query.search || '').trim();
    const like = `%${search}%`;
    const r = await pool.query(
      `SELECT cod_conta AS value,
              cod_conta || ' - ' || COALESCE(nro_conta, '') AS label,
              nro_conta AS nome
         FROM dbconta
        WHERE CAST(cod_conta AS TEXT) LIKE $1
           OR UPPER(COALESCE(nro_conta, '')) LIKE UPPER($2)
        ORDER BY cod_conta
        LIMIT 50`,
      [like, like],
    );
    return res.status(200).json({ contas: r.rows });
  } catch (error: any) {
    console.error('Erro ao buscar contas (dbconta):', error);
    return res.status(500).json({ erro: 'Erro ao buscar contas', detalhes: error.message });
  }
}

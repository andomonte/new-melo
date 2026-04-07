import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface Operadora {
  codopera: string;
  descr: string;
  txopera: number;
  pzopera: number;
  codcli: string;
  nome_cliente: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const pool = getPgPool();

  try {
    const query = `
      SELECT 
        o.codopera,
        o.descr,
        o.txopera,
        o.pzopera,
        o.codcli,
        c.nome as nome_cliente
      FROM db_manaus.dbopera o
      LEFT JOIN db_manaus.dbclien c ON o.codcli = c.codcli
      WHERE COALESCE(o.desativado, 0) = 0
      ORDER BY o.descr
    `;

    const result = await pool.query(query);
    
    const operadoras: Operadora[] = result.rows.map((row: any) => ({
      codopera: row.codopera,
      descr: row.descr,
      txopera: parseFloat(row.txopera || 0),
      pzopera: parseInt(row.pzopera || 0),
      codcli: row.codcli,
      nome_cliente: row.nome_cliente
    }));

    return res.status(200).json(operadoras);
  } catch (error: any) {
    console.error('Erro ao buscar operadoras:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar operadoras',
      details: error.message 
    });
  }
}

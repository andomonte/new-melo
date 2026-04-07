/**
 * Endpoint para listar armazens disponiveis
 * GET /api/entrada/alocacao/armazens
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface Armazem {
  arm_id: number;
  arm_descricao: string;
}

interface ArmazensResponse {
  data: Armazem[];
}

const ARMAZENS_QUERY = `
  SELECT
    arm_id,
    arm_descricao
  FROM cad_armazem
  WHERE arm_status = 'A'
  ORDER BY arm_descricao
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArmazensResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(ARMAZENS_QUERY);

    const armazens: Armazem[] = result.rows.map(row => ({
      arm_id: parseInt(row.arm_id),
      arm_descricao: row.arm_descricao || `Armazém ${row.arm_id}`,
    }));

    return res.status(200).json({
      data: armazens,
    });
  } catch (error) {
    console.error('Erro ao buscar armazens:', error);

    return res.status(500).json({
      error: 'Erro ao buscar armazens',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

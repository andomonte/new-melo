import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface Armazem {
  arm_id: number;
  arm_descricao: string;
  arm_status: string;
  arm_municipio: string | null;
  arm_uf: string | null;
}

interface ListarArmazensResponse {
  armazens: Armazem[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListarArmazensResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Buscar armazéns ativos (incluindo todos para o usuário escolher)
    const result = await client.query(`
      SELECT
        arm_id,
        arm_descricao,
        arm_status,
        arm_municipio,
        arm_uf
      FROM db_manaus.cad_armazem
      WHERE arm_status = 'A'
      ORDER BY arm_id
    `);

    return res.status(200).json({
      armazens: result.rows
    });

  } catch (error: any) {
    console.error('Erro ao listar armazéns:', error);
    return res.status(500).json({
      error: 'Erro ao buscar armazéns',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
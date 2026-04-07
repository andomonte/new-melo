import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface ArmazemCompras {
  arm_id: number;
  arm_descricao: string;
  arm_status: string;
  arm_municipio: string;
  arm_uf: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar apenas armazéns ativos para o contexto de compras/entrada
    const result = await client.query(`
      SELECT
        arm_id,
        arm_descricao,
        arm_status,
        COALESCE(arm_municipio, '') as arm_municipio,
        COALESCE(arm_uf, '') as arm_uf
      FROM cad_armazem
      WHERE arm_status = 'A' OR arm_status IS NULL
      ORDER BY arm_id ASC
    `);

    const armazens: ArmazemCompras[] = result.rows.map(row => ({
      arm_id: row.arm_id,
      arm_descricao: row.arm_descricao || `Armazém ${row.arm_id}`,
      arm_status: row.arm_status || 'A',
      arm_municipio: row.arm_municipio || '',
      arm_uf: row.arm_uf || ''
    }));

    res.status(200).json({
      success: true,
      data: armazens,
      message: `${armazens.length} armazéns disponíveis para entrada`
    });

  } catch (error) {
    console.error('Erro ao buscar armazéns para entrada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar armazéns disponíveis'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
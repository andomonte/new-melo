import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Buscar transportadoras ativas
    const result = await client.query(`
      SELECT
        codtransp,
        nome,
        nomefant,
        cpfcgc
      FROM dbtransp
      ORDER BY nome
      LIMIT 500
    `);

    return res.status(200).json(serializeBigInt({
      success: true,
      data: result.rows.map(t => ({
        codtransp: t.codtransp,
        nome: t.nome || t.nomefant || 'Sem nome',
        cpfcgc: t.cpfcgc
      }))
    }));

  } catch (error) {
    console.error('Erro ao buscar transportadoras:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar transportadoras',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

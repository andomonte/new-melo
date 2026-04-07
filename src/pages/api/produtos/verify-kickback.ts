import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || '01';

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Verificar o produto específico que foi atualizado
    const result = await client.query(`
      SELECT 
        p."codprod",
        p."ref",
        m."descr" as marca,
        kb.dscbalcao45 as preco_kickback
      FROM dbprod p
      INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
      LEFT JOIN dbprecokb kb ON kb.codprod = p."codprod"
      WHERE p."ref" = '1462C00987'
    `);

    const precoOriginal = 18.75;
    const percentual = 4.5;
    const precoEsperado = (precoOriginal * (1 + percentual / 100)).toFixed(2);

    return res.status(200).json({
      success: true,
      produto: result.rows[0] || null,
      calculo: {
        preco_original: precoOriginal,
        percentual: percentual,
        preco_esperado: precoEsperado,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar produto:', error);
    return res.status(500).json({
      error: 'Erro na verificação',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
}

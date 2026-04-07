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
    // 1. Verificar produtos Bosch de teste
    const testProducts = await client.query(`
      SELECT p."codprod", p."ref", m."descr" as marca
      FROM dbprod p
      INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
      WHERE p."ref" IN ('1462C00984', '1462C00985', '1462C00987')
      ORDER BY p."ref"
    `);

    // 2. Verificar constrains da tabela dbprecokb
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'dbprecokb'
      ORDER BY tc.constraint_type, kcu.column_name
    `);

    // 3. Verificar índices
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'dbprecokb'
    `);

    // 4. Verificar alguns registros da tabela
    const sample = await client.query(`
      SELECT codprod, dscbalcao45
      FROM dbprecokb 
      LIMIT 5
    `);

    // 5. Verificar todos os produtos Bosch disponíveis (limitado a 10)
    const boschProducts = await client.query(`
      SELECT p."codprod", p."ref", m."descr" as marca
      FROM dbprod p
      INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
      WHERE UPPER(m."descr") = 'BOSCH'
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      filial,
      testProducts: testProducts.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      sampleData: sample.rows,
      boschProducts: boschProducts.rows,
    });
  } catch (error) {
    console.error('Erro ao diagnosticar:', error);
    return res.status(500).json({
      error: 'Erro no diagnóstico',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
}

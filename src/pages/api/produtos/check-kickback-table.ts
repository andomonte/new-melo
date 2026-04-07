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
    // 1. Verificar se a tabela existe
    const checkTable = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'dbprecokb' 
      AND table_schema = 'public'
    `);

    const tableExists = checkTable.rows.length > 0;

    if (!tableExists) {
      console.log('Tabela dbprecokb não existe. Criando...');

      // 2. Criar a tabela
      await client.query(`
        CREATE TABLE IF NOT EXISTS dbprecokb (
          codprod INTEGER PRIMARY KEY,
          dscbalcao45 DECIMAL(15,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Criar índice
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_dbprecokb_codprod ON dbprecokb(codprod)
      `);

      console.log('Tabela dbprecokb criada com sucesso!');
    } else {
      console.log('Tabela dbprecokb já existe.');
    }

    // 4. Verificar estrutura
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dbprecokb'
      ORDER BY ordinal_position
    `);

    // 5. Contar registros
    const count = await client.query('SELECT COUNT(*) as total FROM dbprecokb');

    return res.status(200).json({
      success: true,
      filial,
      tableExists: tableExists,
      tableCreated: !tableExists,
      structure: columns.rows,
      recordCount: count.rows[0].total,
    });
  } catch (error) {
    console.error('Erro ao verificar/criar tabela dbprecokb:', error);
    return res.status(500).json({
      error: 'Erro ao verificar tabela',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
}

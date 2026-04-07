const { Pool } = require('pg');
require('dotenv').config();

async function consultarEstruturaTransp() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('=== Estrutura da tabela dbtransp ===');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'dbtransp' AND table_schema = 'db_manaus'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);

    console.log('\n=== Amostra de dados dbtransp ===');
    const sampleResult = await pool.query('SELECT * FROM db_manaus.dbtransp LIMIT 3');
    console.table(sampleResult.rows);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

consultarEstruturaTransp();
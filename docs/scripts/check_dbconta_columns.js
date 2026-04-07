const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});


async function checkDbcontaColumns() {
  try {
    console.log('🔍 Verificando colunas da tabela dbconta...\n');

    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbconta'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colunas da tabela db_manaus.dbconta:\n');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name.padEnd(25)} (${row.data_type})`);
    });

    console.log('\n🔍 Verificando colunas da tabela dbbanco...\n');

    const resultBanco = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbbanco'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colunas da tabela db_manaus.dbbanco:\n');
    resultBanco.rows.forEach(row => {
      console.log(`  - ${row.column_name.padEnd(25)} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    pool.end();
  }
}

checkDbcontaColumns();
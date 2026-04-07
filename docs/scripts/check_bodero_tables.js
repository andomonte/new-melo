const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus' 
        AND (table_name LIKE '%bodero%' OR table_name LIKE '%baixa%')
      ORDER BY table_name
    `);

    console.log('\n📋 Tabelas de borderô/baixa encontradas:\n');
    if (result.rows.length === 0) {
      console.log('  ❌ Nenhuma tabela encontrada');
      console.log('\n  Precisa criar: dbdocbodero_baixa_banco');
    } else {
      result.rows.forEach(t => {
        console.log(`  ✓ ${t.table_name}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

checkTables();

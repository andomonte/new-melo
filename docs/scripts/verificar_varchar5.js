const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarVarchar5() {
  try {
    const result = await pool.query(`
      SELECT column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbretorno_detalhe'
        AND character_maximum_length = 5
      ORDER BY ordinal_position
    `);

    console.log('📋 Campos VARCHAR(5) em dbretorno_detalhe:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarVarchar5();

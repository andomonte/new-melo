const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarEstrutura() {
  try {
    console.log('🔍 Verificando estrutura da tabela dbfat_nfe...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbfat_nfe'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colunas da tabela dbfat_nfe:');
    console.table(result.rows);

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

verificarEstrutura();

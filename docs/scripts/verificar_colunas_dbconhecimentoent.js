const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function verificarColunasDbConhecimentoEnt() {
  console.log('🔍 [Colunas] Verificando estrutura da tabela dbconhecimentoent...');

  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbconhecimentoent'
      ORDER BY ordinal_position
    `);

    console.log('📋 [Colunas] Colunas da tabela dbconhecimentoent:');
    result.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('❌ [Colunas] Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarColunasDbConhecimentoEnt();
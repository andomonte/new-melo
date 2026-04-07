// Verificar estrutura da tabela dbdados_banco
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarDadosBanco() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbdados_banco...\n');

    const query = `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbdados_banco'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(query);

    console.log('📋 Colunas da tabela dbdados_banco:\n');
    result.rows.forEach(row => {
      const tipo = row.character_maximum_length 
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type;
      console.log(`   - ${row.column_name.padEnd(30)} ${tipo}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarDadosBanco();

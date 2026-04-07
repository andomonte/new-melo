// Verificar estrutura da tabela dbreceb
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarReceb() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbreceb...\n');

    const queryColunas = `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbreceb'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(queryColunas);

    console.log('📋 Colunas da tabela dbreceb:\n');
    result.rows.forEach(row => {
      const tipo = row.character_maximum_length 
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type;
      console.log(`   - ${row.column_name.padEnd(30)} ${tipo}`);
    });
    
    // Destacar campos com varchar(5)
    console.log('\n⚠️  Campos com VARCHAR(5):');
    const campos5 = result.rows.filter(r => 
      r.data_type === 'character varying' && r.character_maximum_length === 5
    );
    
    campos5.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarReceb();

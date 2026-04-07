const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarSchema() {
  try {
    console.log('🔍 Verificando estrutura das tabelas de retorno...\n');

    // Verificar colunas de dbretorno_arquivo
    const arquivoColumns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbretorno_arquivo'
      ORDER BY ordinal_position
    `);

    console.log('📄 DBRETORNO_ARQUIVO:');
    arquivoColumns.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${col.column_name.padEnd(30)} ${(col.data_type + length).padEnd(25)} ${nullable}`);
    });

    console.log('\n📄 DBRETORNO_DETALHE:');
    // Verificar colunas de dbretorno_detalhe
    const detalheColumns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbretorno_detalhe'
      ORDER BY ordinal_position
    `);

    detalheColumns.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${col.column_name.padEnd(30)} ${(col.data_type + length).padEnd(25)} ${nullable}`);
    });

    // Destacar campos VARCHAR(50)
    console.log('\n⚠️  CAMPOS VARCHAR(50) que podem causar problemas:');
    const varchar50Fields = [...arquivoColumns.rows, ...detalheColumns.rows]
      .filter(col => col.character_maximum_length === 50);
    
    varchar50Fields.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarSchema();

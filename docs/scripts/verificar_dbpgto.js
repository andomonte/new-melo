const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function checkDbPgto() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbpgto...');

    const client = await pool.connect();

    // Verificar estrutura da tabela
    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 TABELA: db_manaus.dbpgto');
    console.log('================================================================================');
    console.table(result.rows);
    console.log(`✅ Total de colunas: ${result.rows.length}`);

    // Verificar se existe o campo titulo_importado
    const tituloImportadoField = result.rows.find(row => row.column_name === 'titulo_importado');
    if (tituloImportadoField) {
      console.log('\n✅ Campo "titulo_importado" encontrado:');
      console.log(`   - Tipo: ${tituloImportadoField.data_type}`);
      console.log(`   - Nullable: ${tituloImportadoField.is_nullable}`);
      console.log(`   - Default: ${tituloImportadoField.column_default || 'null'}`);
    } else {
      console.log('\n❌ Campo "titulo_importado" NÃO encontrado na tabela dbpgto');
    }

    client.release();

  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error);
  } finally {
    await pool.end();
  }
}

checkDbPgto();
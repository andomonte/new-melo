const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function checkDbConhecimentoEnt() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbconhecimentoent...');

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
        AND table_name = 'dbconhecimentoent'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 TABELA: db_manaus.dbconhecimentoent');
    console.log('================================================================================');
    console.table(result.rows);
    console.log(`✅ Total de colunas: ${result.rows.length}`);

    // Mostrar algumas linhas de exemplo
    console.log('\n📄 EXEMPLO DE DADOS (primeiras 3 linhas):');
    console.log('================================================================================');

    const sampleData = await client.query(`
      SELECT * FROM db_manaus.dbconhecimentoent LIMIT 3
    `);

    sampleData.rows.forEach((row, index) => {
      console.log(`\n--- Linha ${index + 1} ---`);
      Object.keys(row).forEach(key => {
        console.log(`${key}: ${row[key]}`);
      });
    });

    client.release();

  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error);
  } finally {
    await pool.end();
  }
}

checkDbConhecimentoEnt();
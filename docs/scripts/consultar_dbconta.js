const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarDbpgto() {
  try {
    console.log('Consultando estrutura da tabela dbpgto...\n');

    // Consultar colunas da tabela dbpgto
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbpgto'
      ORDER BY ordinal_position;
    `);

    console.log(`Total de colunas em dbpgto: ${result.rows.length}\n`);
    console.log('Colunas da tabela db_manaus.dbpgto:');
    console.log('='.repeat(80));
    
    result.rows.forEach((row, index) => {
      const maxLength = row.character_maximum_length ? ` (${row.character_maximum_length})` : '';
      console.log(`${index + 1}. ${row.column_name} - ${row.data_type}${maxLength}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\nConsultando alguns registros de exemplo:');
    console.log('='.repeat(80));

    const sample = await pool.query(`
      SELECT * FROM db_manaus.dbpgto LIMIT 3;
    `);

    console.log('\nPrimeiros 3 registros:');
    sample.rows.forEach((row, index) => {
      console.log(`\nRegistro ${index + 1}:`);
      console.log(JSON.stringify(row, null, 2));
    });

  } catch (error) {
    console.error('Erro ao consultar dbpgto:', error);
  } finally {
    await pool.end();
  }
}

consultarDbpgto();

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarEstrutura() {
  try {
    console.log('Estrutura da tabela dbconta:\n');
    
    const contaCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbconta'
      ORDER BY ordinal_position
      LIMIT 10
    `);

    contaCols.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
    });

    console.log('\n\nEstrutura da tabela dbccusto:\n');
    
    const ccustoCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbccusto'
      ORDER BY ordinal_position
      LIMIT 10
    `);

    ccustoCols.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarEstrutura();

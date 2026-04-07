import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarTodasColunas() {
  try {
    console.log('Todas as colunas da tabela dbcredor:\n');
    
    const credorCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbcredor'
      ORDER BY ordinal_position
      LIMIT 20
    `);

    credorCols.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
    });

    console.log('\n\nTodas as colunas da tabela dbtransp:\n');
    
    const transpCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbtransp'
      ORDER BY ordinal_position
      LIMIT 20
    `);

    transpCols.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarTodasColunas();

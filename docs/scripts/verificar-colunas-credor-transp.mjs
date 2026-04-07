import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarColunas() {
  try {
    console.log('Verificando colunas da tabela dbcredor:\n');
    
    const credorCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbcredor'
        AND (column_name LIKE '%nome%' 
          OR column_name LIKE '%razao%'
          OR column_name LIKE '%codigo%')
      ORDER BY ordinal_position
    `);

    console.log('Colunas de dbcredor:');
    credorCols.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    console.log('\n\nVerificando colunas da tabela dbtransp:\n');
    
    const transpCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbtransp'
        AND (column_name LIKE '%nome%' 
          OR column_name LIKE '%razao%'
          OR column_name LIKE '%codigo%')
      ORDER BY ordinal_position
    `);

    console.log('Colunas de dbtransp:');
    transpCols.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarColunas();

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarNotNull() {
  try {
    console.log('Verificando colunas NOT NULL na tabela dbpgto...\n');
    
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto'
        AND is_nullable = 'NO'
      ORDER BY ordinal_position
    `);

    console.log('Colunas NOT NULL:');
    console.log(JSON.stringify(result.rows, null, 2));

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarNotNull();

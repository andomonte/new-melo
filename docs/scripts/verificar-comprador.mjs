import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarComprador() {
  try {
    console.log('Verificando coluna comprador...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto'
        AND column_name LIKE '%comprador%'
      ORDER BY ordinal_position
    `);

    console.log('Colunas encontradas:');
    console.log(result.rows);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarComprador();

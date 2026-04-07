import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarTabelasContas() {
  try {
    console.log('Procurando tabelas relacionadas a contas e centro de custo...\n');
    
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%conta%' 
          OR table_name LIKE '%ccusto%'
          OR table_name LIKE '%centro%custo%')
      ORDER BY table_name
    `);

    console.log('Tabelas encontradas:');
    result.rows.forEach(row => console.log('-', row.table_name));

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarTabelasContas();

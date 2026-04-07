const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const getPgPool = () => {
  return new Pool({
  connectionString: process.env.DATABASE_URL
  });
};

async function checkComprador() {
  const pool = getPgPool();
  
  try {
    console.log('=== Buscando tabelas com comprador ===');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus' 
        AND (table_name LIKE '%compr%' OR table_name LIKE '%compra%')
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:', tables.rows);
    
    if (tables.rows.length > 0) {
      for (const table of tables.rows) {
        console.log(`\n=== Estrutura de ${table.table_name} ===`);
        const cols = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'db_manaus' AND table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        console.log('Colunas:', cols.rows);
        
        const sample = await pool.query(`SELECT * FROM db_manaus.${table.table_name} LIMIT 3`);
        console.log('Sample:', sample.rows);
      }
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkComprador();

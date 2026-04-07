const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  const c = await pool.connect();
  
  console.log('==========================================');
  console.log('COLUNAS DE DBPGTO_ENT:');
  console.log('==========================================\n');
  
  const r = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_schema='db_manaus' AND table_name='dbpgto_ent' 
    ORDER BY ordinal_position
  `);
  
  r.rows.forEach(row => {
    console.log(`  - ${row.column_name.padEnd(20)} ${row.data_type}`);
  });
  
  c.release();
  await pool.end();
})();

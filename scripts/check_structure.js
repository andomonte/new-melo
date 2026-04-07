// Script para verificar estrutura completa de dbfat_nfe
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('\n📊 Estrutura da tabela db_manaus.dbfat_nfe:\n');
    
    const res = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' AND table_name = 'dbfat_nfe'
      ORDER BY ordinal_position
    `);
    
    console.table(res.rows);
    
    // Listar colunas NOT NULL
    console.log('\n🔴 Colunas NOT NULL:');
    res.rows.filter(r => r.is_nullable === 'NO').forEach(r => {
      console.log(`  - ${r.column_name} (${r.data_type})`);
    });
    
  } catch (err) {
    console.error('ERRO:', err.message);
  } finally {
    await pool.end();
  }
}

main();

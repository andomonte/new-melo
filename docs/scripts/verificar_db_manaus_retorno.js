const { Pool } = require('pg');
const dotenv = require('dotenv');   
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarTabelas() {
  try {
    // Buscar no schema db_manaus
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus' 
        AND table_name LIKE 'dbretorno%'
      ORDER BY table_name
    `);

    console.log('\n📋 Tabelas de retorno no schema db_manaus:');
    console.log('═'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela encontrada!');
    } else {
      for (const row of result.rows) {
        // Contar registros
        const count = await pool.query(`SELECT COUNT(*) as total FROM db_manaus.${row.table_name}`);
        const total = parseInt(count.rows[0].total);
        
        console.log(`✅ ${row.table_name.padEnd(40)} ${total.toLocaleString('pt-BR')} registro(s)`);
      }
      
      console.log('═'.repeat(60));
      console.log(`\n📊 Total: ${result.rows.length} tabela(s)`);
      console.log('\n✅ Tabelas existem! Sistema de retorno pronto para uso.\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarTabelas();

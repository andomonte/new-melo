const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarTabelas() {
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename LIKE 'dbretorno%' OR tablename LIKE 'db_retorno%')
      ORDER BY tablename
    `);

    console.log('\n📋 Tabelas de retorno no PostgreSQL:');
    console.log('═'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela encontrada!');
    } else {
      for (const row of result.rows) {
        // Contar registros
        const count = await pool.query(`SELECT COUNT(*) as total FROM ${row.tablename}`);
        const total = parseInt(count.rows[0].total);
        
        console.log(`✅ ${row.tablename.padEnd(40)} ${total.toLocaleString('pt-BR')} registro(s)`);
        
        // Mostrar estrutura
        const columns = await pool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [row.tablename]);
        
        console.log(`   Colunas (${columns.rows.length}):`);
        columns.rows.forEach((col, idx) => {
          const type = col.character_maximum_length 
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type;
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.column_name.padEnd(35)} ${type.padEnd(25)} ${nullable}`);
        });
        console.log('');
      }
      
      console.log('═'.repeat(60));
      console.log(`📊 Total: ${result.rows.length} tabela(s)\n`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarTabelas();

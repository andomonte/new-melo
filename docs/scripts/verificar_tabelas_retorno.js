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

    console.log('\n📋 Tabelas de retorno encontradas no PostgreSQL:');
    if (result.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela encontrada!');
      console.log('\n💡 As tabelas do Oracle são:');
      console.log('   - dbretorno_arquivo (armazena header do arquivo)');
      console.log('   - dbretorno_detalhe (armazena títulos do arquivo)');
      console.log('\n🔧 Você precisa CRIAR essas tabelas no PostgreSQL porque:');
      console.log('   1. Oracle e PostgreSQL são bancos SEPARADOS');
      console.log('   2. O sistema legado (Delphi) usa Oracle');
      console.log('   3. O novo sistema web usa PostgreSQL');
      console.log('   4. Não há sincronização automática entre eles');
      console.log('\n✅ Execute a migration para criar as tabelas:');
      console.log('   psql -U seu_usuario -d seu_banco -f database/migrations/create_retorno_tables.sql');
    } else {
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.tablename}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarTabelas();

// Verificar estrutura da tabela dbclien
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarCliente() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbclien...\n');

    const queryColunas = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbclien'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(queryColunas);

    console.log('📋 Colunas da tabela dbclien:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    console.log('');

    // Verificar colunas de contato
    const colunasContato = result.rows.filter(r => 
      r.column_name.toLowerCase().includes('fone') ||
      r.column_name.toLowerCase().includes('tel') ||
      r.column_name.toLowerCase().includes('celular') ||
      r.column_name.toLowerCase().includes('email')
    );

    if (colunasContato.length > 0) {
      console.log('📞 Colunas de contato:');
      colunasContato.forEach(row => {
        console.log(`   - ${row.column_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarCliente();

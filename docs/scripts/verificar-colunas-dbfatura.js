// Verificar estrutura da tabela dbfatura
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarFatura() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('� Verificando estrutura da tabela dbfatura...\n');

    const queryColunas = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbfatura'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(queryColunas);

    console.log('📋 Colunas da tabela dbfatura:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    console.log('');

    // Verificar se existe vlr ou valor
    const colunasValor = result.rows.filter(r => 
      r.column_name.toLowerCase().includes('vlr') ||
      r.column_name.toLowerCase().includes('valor')
    );

    if (colunasValor.length > 0) {
      console.log('💰 Colunas relacionadas a valor:');
      colunasValor.forEach(row => {
        console.log(`   - ${row.column_name}`);
      });
    } else {
      console.log('❌ Nenhuma coluna relacionada a valor encontrada!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarFatura();


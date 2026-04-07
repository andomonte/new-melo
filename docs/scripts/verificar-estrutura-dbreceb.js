// Verificar estrutura da tabela dbreceb
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function verificarDbreceb() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando estrutura da tabela dbreceb...\n');

    const queryColunas = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbreceb'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(queryColunas);

    console.log('📋 Colunas da tabela dbreceb:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    console.log('');

    // Verificar se existe codreceb ou cod_receb ou similar
    const colunasReceb = result.rows.filter(r => 
      r.column_name.toLowerCase().includes('receb') ||
      r.column_name.toLowerCase().includes('cod')
    );

    if (colunasReceb.length > 0) {
      console.log('🔑 Colunas relacionadas a código/receb:');
      colunasReceb.forEach(row => {
        console.log(`   - ${row.column_name}`);
      });
      console.log('');
    }

    // Buscar exemplo de dados
    const queryExemplo = `
      SELECT * FROM db_manaus.dbreceb 
      WHERE forma_fat = 'B'
      LIMIT 1;
    `;

    const exemploResult = await pool.query(queryExemplo);

    if (exemploResult.rows.length > 0) {
      console.log('📊 Exemplo de registro (boleto):');
      const registro = exemploResult.rows[0];
      Object.keys(registro).forEach(key => {
        console.log(`   ${key}: ${registro[key]}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarDbreceb();

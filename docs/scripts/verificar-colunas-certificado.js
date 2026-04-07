const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();


async function verificarColunasCertificado() {
    const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
  try {
    console.log('🔍 Verificando colunas de certificado na tabela dadosempresa...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dadosempresa' 
        AND column_name LIKE '%certif%'
      ORDER BY column_name
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma coluna com "certif" encontrada na tabela dadosempresa');
      console.log('\n📋 Listando TODAS as colunas da tabela dadosempresa:\n');
      
      const allColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
          AND table_name = 'dadosempresa'
        ORDER BY ordinal_position
      `);
      
      allColumns.rows.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('✅ Colunas de certificado encontradas:\n');
      result.rows.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name} (${col.data_type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar colunas:', error.message);
  } finally {
    await pool.end();
  }
}

verificarColunasCertificado();

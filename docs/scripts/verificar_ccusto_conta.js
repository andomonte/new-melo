const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificarCentroCustoConta() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando estrutura da tabela dbccusto...\n');
    
    // Verificar colunas
    const colunas = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbccusto'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela dbccusto:');
    colunas.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Verificar se tem cod_conta
    const temCodConta = colunas.rows.some(col => col.column_name === 'cod_conta');
    
    console.log('\n✅ Resultado:');
    if (temCodConta) {
      console.log('✓ A tabela dbccusto TEM o campo cod_conta');
      
      // Buscar exemplos
      const exemplos = await client.query(`
        SELECT cod_ccusto, descricao, cod_conta 
        FROM db_manaus.dbccusto 
        WHERE cod_conta IS NOT NULL 
        LIMIT 5
      `);
      
      console.log('\n📊 Exemplos de centros de custo com conta associada:');
      exemplos.rows.forEach(row => {
        console.log(`  Centro: ${row.cod_ccusto} - ${row.descricao} → Conta: ${row.cod_conta}`);
      });
    } else {
      console.log('✗ A tabela dbccusto NÃO tem o campo cod_conta');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarCentroCustoConta();

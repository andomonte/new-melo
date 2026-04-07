const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificarColunasPagamentoInternacional() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando colunas de pagamento internacional...\n');
    
    // Verificar dbpgto
    const colunasDbpgto = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbpgto'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela dbpgto:');
    const colunasNecessarias = ['moeda', 'taxa_conversao', 'valor_moeda', 'nro_invoice', 'nro_contrato', 'eh_internacional'];
    
    colunasNecessarias.forEach(coluna => {
      const existe = colunasDbpgto.rows.some(row => row.column_name === coluna);
      console.log(`  ${existe ? '✓' : '✗'} ${coluna} ${existe ? '(existe)' : '(NÃO existe)'}`);
    });
    
    // Verificar dbfpgto
    const colunasDbfpgto = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfpgto'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Colunas da tabela dbfpgto:');
    colunasNecessarias.forEach(coluna => {
      const existe = colunasDbfpgto.rows.some(row => row.column_name === coluna);
      console.log(`  ${existe ? '✓' : '✗'} ${coluna} ${existe ? '(existe)' : '(NÃO existe)'}`);
    });
    
    console.log('\n💡 Colunas necessárias para pagamento internacional:');
    console.log('  - eh_internacional (boolean): Flag para identificar se é internacional');
    console.log('  - moeda (varchar): Ex: EUR, USD, GBP');
    console.log('  - taxa_conversao (numeric): Taxa de câmbio usada');
    console.log('  - valor_moeda (numeric): Valor na moeda estrangeira');
    console.log('  - nro_invoice (varchar): Número da invoice (substituir NF)');
    console.log('  - nro_contrato (varchar): Número do contrato internacional');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarColunasPagamentoInternacional();

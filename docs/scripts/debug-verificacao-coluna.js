require('dotenv').config();
const { Pool } = require('pg');

async function testarVerificacaoColuna() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Testando verificação da coluna codgp...\n');
    
    // Teste 1: Verificar se a coluna existe (em qualquer schema)
    const columnCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'dbfatura'
        AND column_name = 'codgp'
      );
    `;
    
    console.log('📋 Query sendo executada (qualquer schema):');
    console.log(columnCheckQuery);
    
    const columnCheckResult = await client.query(columnCheckQuery);
    console.log('\n✅ Resultado da verificação:');
    console.log('Raw result:', columnCheckResult.rows);
    console.log('Exists value:', columnCheckResult.rows[0].exists);
    console.log('Type of exists:', typeof columnCheckResult.rows[0].exists);
    
    const hasCodgpColumn = columnCheckResult.rows[0].exists;
    console.log('hasCodgpColumn:', hasCodgpColumn);
    
    // Teste 2: Listar todas as colunas da tabela dbfatura para debug (em todos os schemas)
    console.log('\n📊 Todas as colunas da tabela dbfatura (todos os schemas):');
    const allColumnsResult = await client.query(`
      SELECT table_schema, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dbfatura'
      AND column_name IN ('codgp', 'agp', 'codfat', 'nroform')
      ORDER BY table_schema, column_name;
    `);
    
    console.table(allColumnsResult.rows);
    
    // Teste 3: Verificar schema atual
    console.log('\n🗂️ Schema da tabela:');
    const schemaResult = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'dbfatura';
    `);
    
    console.table(schemaResult.rows);
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao testar verificação:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testarVerificacaoColuna();

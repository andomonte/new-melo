require('dotenv').config();
const { Pool } = require('pg');

async function testarSchemaDbManaus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Testando verificação da coluna codgp no schema db_manaus...\n');
    
    // Teste 1: Verificar se a coluna existe no schema db_manaus
    const columnCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfatura'
        AND column_name = 'codgp'
      );
    `;
    
    console.log('📋 Query sendo executada:');
    console.log(columnCheckQuery);
    
    const columnCheckResult = await client.query(columnCheckQuery);
    console.log('\n✅ Resultado da verificação:');
    console.log('Raw result:', columnCheckResult.rows);
    console.log('Exists value:', columnCheckResult.rows[0].exists);
    
    const hasCodgpColumn = columnCheckResult.rows[0].exists;
    console.log('hasCodgpColumn:', hasCodgpColumn);
    
    if (hasCodgpColumn) {
      console.log('\n🎉 SUCESSO! Coluna codgp encontrada no schema db_manaus');
      
      // Teste 2: Verificar dados de agrupamento
      console.log('\n📊 Testando consulta com schema db_manaus:');
      
      const testQuery = `
        SELECT 
          f.codfat,
          f.nroform,
          f.data,
          f.totalnf,
          f.codgp,
          f.agp,
          c.nome AS cliente_nome
        FROM db_manaus.dbfatura f
        LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
        WHERE f.codgp IS NOT NULL
        ORDER BY f.codgp, f.data DESC
        LIMIT 5;
      `;
      
      const testResult = await client.query(testQuery);
      console.log(`Encontradas ${testResult.rows.length} faturas agrupadas:`);
      console.table(testResult.rows);
      
      // Teste 3: Simular o filtro da API
      console.log('\n🔍 Testando filtro de agrupamento (como na API):');
      
      const filterQuery = `
        SELECT COUNT(*) as total
        FROM db_manaus.dbfatura f
        LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
        WHERE (c.nome IS NOT NULL AND c.nome <> '' AND f.nroform IS NOT NULL AND f.nroform <> '') 
        AND (f.nfs = $1) 
        AND f.codgp IS NOT NULL;
      `;
      
      const filterResult = await client.query(filterQuery, ['S']);
      console.log(`Total de faturas agrupadas com NFS='S': ${filterResult.rows[0].total}`);
      
    } else {
      console.log('\n❌ Coluna codgp NÃO encontrada no schema db_manaus');
      console.log('Verificando se a tabela existe...');
      
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'db_manaus'
          AND table_name = 'dbfatura'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('✅ Tabela db_manaus.dbfatura existe');
        console.log('❌ Mas a coluna codgp não foi encontrada');
      } else {
        console.log('❌ Tabela db_manaus.dbfatura não existe');
      }
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao testar schema db_manaus:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testarSchemaDbManaus();

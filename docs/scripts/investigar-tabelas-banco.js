const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function investigarTabelasBanco() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    console.log('============================================');
    console.log('INVESTIGAÇÃO: TABELAS DE BANCOS');
    console.log('============================================\n');

    // 1. Verificar se existe tabela dbcanto
    console.log('1. VERIFICANDO TABELA DBCANTO:');
    console.log('-------------------------------');
    const dbcantoExists = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbcanto'
    `);
    
    if (dbcantoExists.rows.length > 0) {
      console.log('✅ Tabela DBCANTO encontrada!\n');
      
      // Estrutura da tabela
      const dbcantoColumns = await client.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbcanto'
        ORDER BY ordinal_position
      `);
      
      console.log('Colunas da DBCANTO:');
      dbcantoColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name.padEnd(30)} ${col.data_type}${col.character_maximum_length ? '(' + col.character_maximum_length + ')' : ''}`);
      });
      
      // Dados da tabela
      const dbcantoData = await client.query(`
        SELECT * FROM db_manaus.dbcanto
        LIMIT 20
      `);
      
      console.log(`\nRegistros encontrados: ${dbcantoData.rows.length}\n`);
      dbcantoData.rows.forEach((row, idx) => {
        console.log(`--- Registro ${idx + 1} ---`);
        Object.keys(row).forEach(key => {
          console.log(`  ${key}: ${row[key]}`);
        });
        console.log('');
      });
    } else {
      console.log('❌ Tabela DBCANTO não encontrada\n');
    }

    // 2. Verificar se existe tabela dbconta
    console.log('\n2. VERIFICANDO TABELA DBCONTA:');
    console.log('-------------------------------');
    const dbcontaExists = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbconta'
    `);
    
    if (dbcontaExists.rows.length > 0) {
      console.log('✅ Tabela DBCONTA encontrada!\n');
      
      // Estrutura da tabela
      const dbcontaColumns = await client.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbconta'
        ORDER BY ordinal_position
      `);
      
      console.log('Colunas da DBCONTA:');
      dbcontaColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name.padEnd(30)} ${col.data_type}${col.character_maximum_length ? '(' + col.character_maximum_length + ')' : ''}`);
      });
      
      // Dados da tabela
      const dbcontaData = await client.query(`
        SELECT * FROM db_manaus.dbconta
        ORDER BY cod_conta
        LIMIT 50
      `);
      
      console.log(`\nRegistros encontrados: ${dbcontaData.rows.length}\n`);
      dbcontaData.rows.forEach((row, idx) => {
        console.log(`--- Registro ${idx + 1} ---`);
        Object.keys(row).forEach(key => {
          console.log(`  ${key}: ${row[key]}`);
        });
        console.log('');
      });
    } else {
      console.log('❌ Tabela DBCONTA não encontrada\n');
    }

    // 3. Buscar outras tabelas relacionadas a banco
    console.log('\n3. BUSCANDO OUTRAS TABELAS RELACIONADAS A BANCO:');
    console.log('-------------------------------------------------');
    const tabelasBanco = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
      AND (
        table_name LIKE '%banco%'
        OR table_name LIKE '%portador%'
        OR table_name LIKE '%conta%'
      )
      ORDER BY table_name
    `);
    
    console.log(`\nEncontradas ${tabelasBanco.rows.length} tabelas:\n`);
    tabelasBanco.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // 4. Verificar se há campo banco em alguma tabela
    console.log('\n\n4. VERIFICANDO CAMPOS "BANCO" EM TODAS AS TABELAS:');
    console.log('---------------------------------------------------');
    const camposBanco = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND (
        column_name LIKE '%banco%'
        OR column_name LIKE '%portador%'
      )
      ORDER BY table_name, column_name
    `);
    
    console.log(`\nEncontrados ${camposBanco.rows.length} campos:\n`);
    camposBanco.rows.forEach(row => {
      console.log(`  ${row.table_name.padEnd(30)} | ${row.column_name.padEnd(20)} | ${row.data_type}`);
    });

    console.log('\n\n============================================');
    console.log('INVESTIGAÇÃO CONCLUÍDA!');
    console.log('============================================');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

investigarTabelasBanco();

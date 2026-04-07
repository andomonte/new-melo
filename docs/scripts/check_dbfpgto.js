const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkDbfpgto() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Verificando tabela dbfpgto...\n');

    // Verificar se a tabela existe
    const checkTable = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbfpgto'
      );
    `;

    const tableExists = await client.query(checkTable);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabela dbfpgto não encontrada no schema db_manaus');
      
      // Procurar em outros schemas
      const searchOtherSchemas = `
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name LIKE '%fpgto%'
        ORDER BY table_schema, table_name;
      `;
      
      const otherTables = await client.query(searchOtherSchemas);
      if (otherTables.rows.length > 0) {
        console.log('\n📋 Tabelas similares encontradas:');
        otherTables.rows.forEach(row => {
          console.log(`  - ${row.table_schema}.${row.table_name}`);
        });
      }
      return;
    }

    console.log('✅ Tabela dbfpgto encontrada!\n');

    // Buscar estrutura da tabela
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbfpgto'
      ORDER BY ordinal_position;
    `;

    const columns = await client.query(columnsQuery);

    console.log(`📊 Estrutura da tabela dbfpgto (${columns.rows.length} colunas):\n`);
    columns.rows.forEach((col, index) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`${index + 1}. ${col.column_name}: ${col.data_type}${length} ${nullable}`);
    });

    // Verificar triggers
    console.log('\n🔍 Verificando triggers na tabela dbfpgto...\n');
    
    const triggersQuery = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'db_manaus'
        AND event_object_table = 'dbfpgto'
      ORDER BY trigger_name;
    `;

    const triggers = await client.query(triggersQuery);

    if (triggers.rows.length === 0) {
      console.log('❌ Nenhum trigger encontrado');
    } else {
      console.log(`✅ Encontrados ${triggers.rows.length} trigger(s):\n`);
      triggers.rows.forEach((trigger, index) => {
        console.log(`Trigger ${index + 1}:`);
        console.log(`  Nome: ${trigger.trigger_name}`);
        console.log(`  Evento: ${trigger.event_manipulation}`);
        console.log(`  Timing: ${trigger.action_timing}`);
        console.log(`  Ação: ${trigger.action_statement}`);
        console.log('');
      });
    }

    // Buscar alguns registros de exemplo
    console.log('\n📝 Exemplos de registros (primeiros 3):\n');
    const sampleQuery = `
      SELECT * FROM db_manaus.dbfpgto
      LIMIT 3;
    `;

    const samples = await client.query(sampleQuery);
    
    if (samples.rows.length > 0) {
      samples.rows.forEach((row, index) => {
        console.log(`Registro ${index + 1}:`);
        console.log(JSON.stringify(row, null, 2));
        console.log('');
      });
    } else {
      console.log('⚠️  Tabela vazia - sem registros');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkDbfpgto();

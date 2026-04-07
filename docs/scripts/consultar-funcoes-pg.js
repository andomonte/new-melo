const { Pool } = require('pg');

async function consultarFuncoesProcedures() {
  const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'seu_banco',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');

    // Consultar funções e procedures relacionadas
    const queryFunctions = `
      SELECT 
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition,
        CASE 
          WHEN p.prokind = 'f' THEN 'FUNCTION'
          WHEN p.prokind = 'p' THEN 'PROCEDURE'
          WHEN p.prokind = 'a' THEN 'AGGREGATE'
          WHEN p.prokind = 'w' THEN 'WINDOW'
        END as type
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND (
          LOWER(p.proname) LIKE '%pgto%'
          OR LOWER(p.proname) LIKE '%pagar%'
          OR LOWER(p.proname) LIKE '%titulo%'
          OR LOWER(p.proname) LIKE '%boleto%'
          OR LOWER(p.proname) LIKE '%duplicata%'
          OR LOWER(p.proname) LIKE '%cobranca%'
          OR LOWER(p.proname) LIKE '%credor%'
        )
      ORDER BY n.nspname, p.proname
    `;

    const result = await client.query(queryFunctions);

    console.log('\n📋 Functions/Procedures relacionadas a Contas a Pagar:\n');
    console.log('========================================================\n');

    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row.type}: ${row.schema_name}.${row.function_name}`);
        console.log(`   Argumentos: ${row.arguments || 'Nenhum'}`);
        console.log('\n   Definição:');
        console.log('   ' + '─'.repeat(70));
        console.log(row.definition);
        console.log('   ' + '─'.repeat(70));
      });
    } else {
      console.log('❌ Nenhuma função/procedure encontrada com esses critérios.');
    }

    // Consultar triggers relacionados
    console.log('\n\n⚡ Triggers relacionados a Contas a Pagar:\n');
    console.log('========================================================\n');

    const queryTriggers = `
      SELECT 
        t.trigger_name,
        t.event_manipulation,
        t.event_object_table,
        t.action_statement,
        t.action_timing
      FROM information_schema.triggers t
      WHERE (
        LOWER(t.trigger_name) LIKE '%pgto%'
        OR LOWER(t.trigger_name) LIKE '%pagar%'
        OR LOWER(t.event_object_table) LIKE '%pgto%'
        OR LOWER(t.event_object_table) LIKE '%pagar%'
      )
      ORDER BY t.event_object_table, t.trigger_name
    `;

    const triggersResult = await client.query(queryTriggers);

    if (triggersResult.rows.length > 0) {
      triggersResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Trigger: ${row.trigger_name}`);
        console.log(`   Tabela: ${row.event_object_table}`);
        console.log(`   Evento: ${row.action_timing} ${row.event_manipulation}`);
        console.log(`   Action: ${row.action_statement.substring(0, 200)}...`);
      });
    } else {
      console.log('❌ Nenhum trigger encontrado.');
    }

    // Consultar views relacionadas
    console.log('\n\n📊 Views relacionadas a Contas a Pagar:\n');
    console.log('========================================================\n');

    const queryViews = `
      SELECT 
        table_schema,
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND (
          LOWER(table_name) LIKE '%pgto%'
          OR LOWER(table_name) LIKE '%pagar%'
          OR LOWER(table_name) LIKE '%titulo%'
        )
      ORDER BY table_schema, table_name
    `;

    const viewsResult = await client.query(queryViews);

    if (viewsResult.rows.length > 0) {
      viewsResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. View: ${row.table_schema}.${row.table_name}`);
        console.log(`   SQL: ${row.view_definition.substring(0, 300)}...`);
      });
    } else {
      console.log('❌ Nenhuma view encontrada.');
    }

  } catch (err) {
    console.error('❌ Erro ao consultar PostgreSQL:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n✅ Conexão fechada');
  }
}

consultarFuncoesProcedures();

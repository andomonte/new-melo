const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkTriggers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Verificando triggers na tabela dbpgto...\n');

    const query = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'db_manaus'
        AND event_object_table = 'dbpgto'
      ORDER BY trigger_name;
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum trigger encontrado na tabela dbpgto');
    } else {
      console.log(`✅ Encontrados ${result.rows.length} trigger(s):\n`);
      result.rows.forEach((trigger, index) => {
        console.log(`Trigger ${index + 1}:`);
        console.log(`  Nome: ${trigger.trigger_name}`);
        console.log(`  Evento: ${trigger.event_manipulation}`);
        console.log(`  Timing: ${trigger.action_timing}`);
        console.log(`  Ação: ${trigger.action_statement}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar triggers:', error.message);
  } finally {
    await client.end();
  }
}

checkTriggers();

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkDbpgtoFunctions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Verificando funções/procedures relacionadas a dbpgto...\n');

    // Buscar funções que possam estar relacionadas
    const query = `
      SELECT 
        routine_schema,
        routine_name,
        routine_type,
        specific_name
      FROM information_schema.routines
      WHERE routine_schema = 'db_manaus'
        AND (routine_definition LIKE '%dbpgto%' OR routine_name LIKE '%pgto%')
      ORDER BY routine_name;
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma função/procedure encontrada');
    } else {
      console.log(`✅ Encontradas ${result.rows.length} função/procedure:\n`);
      result.rows.forEach((func, index) => {
        console.log(`${index + 1}. ${func.routine_name} (${func.routine_type})`);
      });
    }

    // Verificar também views
    console.log('\n🔍 Verificando views relacionadas a dbpgto...\n');
    
    const viewQuery = `
      SELECT 
        table_schema,
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%pgto%' OR view_definition LIKE '%dbpgto%')
      ORDER BY table_name;
    `;

    const viewResult = await client.query(viewQuery);

    if (viewResult.rows.length === 0) {
      console.log('❌ Nenhuma view encontrada');
    } else {
      console.log(`✅ Encontradas ${viewResult.rows.length} view(s):\n`);
      viewResult.rows.forEach((view, index) => {
        console.log(`${index + 1}. ${view.table_name}`);
        console.log(`   Definição: ${view.view_definition.substring(0, 200)}...`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkDbpgtoFunctions();

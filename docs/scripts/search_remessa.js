const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function searchRemessaTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Procurando tabelas relacionadas a remessa...\n');

    // Procurar tabelas com 'remessa' no nome
    const tablesResult = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%remessa%' OR table_name LIKE '%remess%')
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('❌ Nenhuma tabela com "remessa" no nome encontrada!');
    } else {
      console.log('📋 Tabelas encontradas:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_schema}.${row.table_name}`);
      });
    }

    // Procurar colunas com 'remessa' no nome
    console.log('\n🔍 Procurando colunas relacionadas a remessa...\n');
    const columnsResult = await client.query(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (column_name LIKE '%remessa%' OR column_name LIKE '%remess%')
      ORDER BY table_name, column_name;
    `);

    if (columnsResult.rows.length === 0) {
      console.log('❌ Nenhuma coluna com "remessa" no nome encontrada!');
    } else {
      console.log('📋 Colunas encontradas:');
      columnsResult.rows.forEach(row => {
        console.log(`- ${row.table_schema}.${row.table_name}.${row.column_name}`);
      });
    }

    // Listar todas as tabelas do schema public para ver se há algo similar
    console.log('\n📋 Todas as tabelas do schema public (primeiras 20):');
    const allTablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 20;
    `);

    allTablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

searchRemessaTables().catch(console.error);
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function listAllDBTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('📋 Todas as tabelas que começam com "db":\n');

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name LIKE 'db%'
      ORDER BY table_name;
    `);

    result.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

listAllDBTables().catch(console.error);
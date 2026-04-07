const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbclien'
      ORDER BY ordinal_position
    `);

    console.log('Colunas da tabela dbclien:');
    result.rows.forEach((row) => console.log('- ' + row.column_name));
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

checkColumns();

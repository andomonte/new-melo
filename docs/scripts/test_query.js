const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function testQuery() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Teste com aspas duplas
    console.log('Testando com aspas duplas...');
    const result = await client.query('SELECT "CODREMESSA", "CODREMESSA_DETALHE" FROM db_manaus.dbremessa_detalhe LIMIT 1');
    console.log('Sucesso:', result.rows[0]);

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

testQuery();
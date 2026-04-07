const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function testQuery() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Testando query SELECT na dbpgto...\n');

    // Testar a query exata do código
    const checkQuery = `
      SELECT paga, cancel, dt_venc, valor_pgto, tipo, obs
      FROM dbpgto 
      WHERE cod_pgto = $1
    `;
    
    console.log('Query a ser testada:');
    console.log(checkQuery);
    console.log('\nExecutando com cod_pgto = 27585...\n');

    const result = await client.query(checkQuery, ['27585']);

    console.log(`✅ Query executada com sucesso! Retornou ${result.rows.length} linha(s)`);
    if (result.rows.length > 0) {
      console.log('Dados:', result.rows[0]);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('\nPosição do erro:', error.position);
    console.error('Mensagem:', error.message);
  } finally {
    await client.end();
  }
}

testQuery();

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkDbccustoStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Verificando estrutura da tabela dbccusto...\n');

    // Verificar colunas da tabela dbccusto
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbccusto'
      ORDER BY ordinal_position;
    `;

    const columnsResult = await client.query(columnsQuery);

    console.log('📋 Colunas da tabela dbccusto:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Verificar alguns registros de exemplo
    const sampleQuery = `
      SELECT * FROM dbccusto LIMIT 3;
    `;

    const sampleResult = await client.query(sampleQuery);
    console.log(`\n📝 Registros de exemplo (${sampleResult.rows.length}):`);
    sampleResult.rows.forEach((row, index) => {
      console.log(`${index + 1}.`, JSON.stringify(row, null, 2));
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

checkDbccustoStructure();
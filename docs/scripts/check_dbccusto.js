const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

client.connect()
  .then(() => {
    console.log('✅ Conectado ao banco');
    return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'dbccusto' ORDER BY ordinal_position");
  })
  .then(result => {
    console.log('📋 Colunas da tabela dbccusto:');
    result.rows.forEach(row => console.log('  -', row.column_name));
    return client.end();
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    client.end();
  });
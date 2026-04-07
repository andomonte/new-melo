const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function analisarRelacionamentoBanco() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Verificar colunas relacionadas a banco na dbreceb
    console.log('Colunas relacionadas a banco na tabela dbreceb:');
    const colunasBanco = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbreceb'
      AND column_name LIKE '%banco%'
      ORDER BY column_name
    `);

    colunasBanco.rows.forEach(row => {
      console.log('- ' + row.column_name);
    });

    // Verificar se há coluna de banco na dbreceb
    const estruturaDbreceb = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbreceb'
      ORDER BY ordinal_position
    `);

    console.log('\nEstrutura completa da tabela dbreceb:');
    estruturaDbreceb.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });

    // Verificar alguns registros de exemplo para entender o padrão
    console.log('\nExemplos de registros dbreceb:');
    const exemplos = await client.query(`
      SELECT "cod_receb", codcli, valor_rec, banco, nro_banco
      FROM db_manaus.dbreceb
      WHERE banco IS NOT NULL
      LIMIT 5
    `);

    exemplos.rows.forEach(row => {
      console.log(row);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

analisarRelacionamentoBanco();
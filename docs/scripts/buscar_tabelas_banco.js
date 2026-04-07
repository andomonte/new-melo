const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function buscarTabelasBanco() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Buscar tabelas relacionadas a banco
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
      AND table_name LIKE '%banco%'
    `);

    console.log('Tabelas relacionadas a banco:');
    result.rows.forEach(row => {
      console.log('- ' + row.table_name);
    });

    // Se encontrou dbbanco, mostrar estrutura
    if (result.rows.some(row => row.table_name === 'dbbanco')) {
      console.log('\nEstrutura da tabela dbbanco:');
      const estrutura = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbbanco'
        ORDER BY ordinal_position
      `);

      estrutura.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });

      // Mostrar alguns registros de exemplo
      console.log('\nExemplos de bancos:');
      const bancos = await client.query(`
        SELECT * FROM db_manaus.dbbanco LIMIT 5
      `);

      bancos.rows.forEach(banco => {
        console.log(banco);
      });
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

buscarTabelasBanco();
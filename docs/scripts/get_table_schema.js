const { Pool } = require('pg');

async function getTableSchema(tableName) {
  let pool;
  let client;

  try {
    const connectionString = "postgresql://postgres:melodb@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15";
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });

    client = await pool.connect();

    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const result = await client.query(query, [tableName]);

    if (result.rows.length === 0) {
      console.log(`Tabela '${tableName}' não encontrada no esquema 'db_manaus'.`);
    } else {
      console.log(`Esquema da tabela '${tableName}' no esquema 'db_manaus':`);
      console.table(result.rows);
    }

  } catch (err) {
    console.error(`Erro ao obter esquema da tabela '${tableName}':`, err);
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

// Chamar a função para as tabelas de interesse
getTableSchema('cmp_ordem_compra');
getTableSchema('cmp_ordem_log');

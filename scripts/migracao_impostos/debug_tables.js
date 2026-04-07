const { Client } = require('pg');

const PG_CONFIG = {
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
};

async function main() {
  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();

  const tables = [
    'cad_legislacao_icmsst',
    'cad_legislacao_icmsst_ncm',
    'fis_tributo_aliquota',
    'dbcest'
  ];

  for (const tableName of tables) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TABELA: ${tableName.toUpperCase()}`);
    console.log('='.repeat(80));

    // Verificar se existe
    const existsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = $1
      );
    `;
    const exists = await pgClient.query(existsQuery, [tableName]);

    if (!exists.rows[0].exists) {
      console.log('Tabela NÃO EXISTE no PostgreSQL\n');
      continue;
    }

    // Verificar estrutura da tabela
    const structureQuery = `
      SELECT DISTINCT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY column_name;
    `;

    const structure = await pgClient.query(structureQuery, [tableName]);
    console.log(`\nColunas (${structure.rows.length}):`);
    structure.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      console.log(`  - ${row.column_name}: ${row.data_type}${length} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Contar registros
    const countResult = await pgClient.query(`SELECT COUNT(*) FROM ${tableName}`);
    console.log(`\nTotal de registros: ${countResult.rows[0].count}`);

    // Se houver registros, mostrar alguns
    if (parseInt(countResult.rows[0].count) > 0) {
      const sampleResult = await pgClient.query(`SELECT * FROM ${tableName} LIMIT 2`);
      console.log('\nAmostra de 2 registros:');
      console.log(JSON.stringify(sampleResult.rows, null, 2));
    }
  }

  await pgClient.end();
}

main().catch(console.error);

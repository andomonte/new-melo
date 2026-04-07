const { Pool } = require('pg');

const pool = new Pool({
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
});

async function checkTable() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO db_manaus');

    // Check table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbnfe_ent'
      ORDER BY ordinal_position
    `);

    console.log('Estrutura da tabela dbnfe_ent:');
    console.log('=============================');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check if we already have user tracking fields
    const hasUserField = result.rows.some(r =>
      r.column_name === 'processamento_user_id' ||
      r.column_name === 'codusr_processando'
    );

    console.log('\n');
    console.log('Campos de controle de usuario existem:', hasUserField);

  } finally {
    client.release();
    await pool.end();
  }
}

checkTable().catch(console.error);

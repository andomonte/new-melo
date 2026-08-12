const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  // 1. Todas as funções cadastradas
  console.log('=== TB_LOGIN_FUNCTIONS ===');
  const r1 = await client.query(`SELECT * FROM db_manaus.tb_login_functions ORDER BY id_functions`);
  r1.rows.forEach(r => console.log(r));

  // 2. Estrutura da tabela
  console.log('\n=== ESTRUTURA TB_LOGIN_FUNCTIONS ===');
  const r2 = await client.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'tb_login_functions' AND table_schema = 'db_manaus'
    ORDER BY ordinal_position
  `);
  r2.rows.forEach(r => console.log(r));

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

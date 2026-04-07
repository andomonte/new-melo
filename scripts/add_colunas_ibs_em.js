const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
  ssl: false
});

async function run() {
  const client = await pool.connect();
  await client.query('SET search_path TO db_manaus');

  console.log('=== Criando colunas IBS Estadual e Municipal ===\n');

  // IBS Estadual (alíquota)
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS ibs_e NUMERIC(5,2)');
  console.log('✓ ibs_e (IBS Estadual - alíquota) criada');

  // IBS Municipal (alíquota)
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS ibs_m NUMERIC(5,2)');
  console.log('✓ ibs_m (IBS Municipal - alíquota) criada');

  console.log('\n✅ Colunas criadas com sucesso!');

  // Listar colunas IBS
  const result = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'db_manaus'
    AND table_name = 'dbitvenda'
    AND column_name LIKE '%ibs%'
    ORDER BY column_name
  `);

  console.log('\n=== Colunas IBS na dbitvenda ===');
  result.rows.forEach(r => {
    console.log(`  ${r.column_name.padEnd(20)} NUMERIC(${r.numeric_precision},${r.numeric_scale})`);
  });

  client.release();
  await pool.end();
}

run().catch(e => console.error(e));

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
  ssl: false
});

async function run() {
  const client = await pool.connect();
  await client.query('SET search_path TO db_manaus');

  console.log('=== Criando colunas de alíquotas padronizadas ===\n');

  // ICMS - já tem icms (alíquota) e totalicms (valor), criar aliquota_icms e valor_icms
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(5,2)');
  console.log('✓ aliquota_icms criada');

  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_icms NUMERIC(15,4)');
  console.log('✓ valor_icms criada');

  // IPI - já tem ipi (alíquota) e totalipi (valor), criar aliquota_ipi e valor_ipi
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC(5,2)');
  console.log('✓ aliquota_ipi criada');

  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_ipi NUMERIC(15,4)');
  console.log('✓ valor_ipi criada');

  // PIS - já tem pis (alíquota) e valorpis (valor), criar aliquota_pis e valor_pis
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC(5,2)');
  console.log('✓ aliquota_pis criada');

  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_pis NUMERIC(15,4)');
  console.log('✓ valor_pis criada');

  // COFINS - já tem cofins (alíquota) e valorcofins (valor), criar aliquota_cofins e valor_cofins
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC(5,2)');
  console.log('✓ aliquota_cofins criada');

  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_cofins NUMERIC(15,4)');
  console.log('✓ valor_cofins criada');

  // ST - criar aliquota_st e valor_st (já tem totalsubst_trib)
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_st NUMERIC(5,2)');
  console.log('✓ aliquota_st criada');

  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_st NUMERIC(15,4)');
  console.log('✓ valor_st criada');

  // FCP - já tem fcp (alíquota) e valor_fcp (valor), mas vou criar aliquota_fcp para padronizar
  await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_fcp NUMERIC(5,2)');
  console.log('✓ aliquota_fcp criada');

  console.log('\n✅ Todas as colunas de alíquotas criadas!');

  // Listar colunas de alíquota e valor
  const result = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'db_manaus'
    AND table_name = 'dbitvenda'
    AND (column_name LIKE 'aliquota_%' OR column_name LIKE 'valor_%')
    ORDER BY column_name
  `);

  console.log('\n=== Colunas de alíquota e valor na dbitvenda ===');
  result.rows.forEach(r => {
    console.log(`  ${r.column_name.padEnd(20)} NUMERIC(${r.numeric_precision},${r.numeric_scale})`);
  });

  client.release();
  await pool.end();
}

run();

const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres";

async function run() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false,
  });

  const client = await pool.connect();

  try {
    // Definir o schema
    await client.query('SET search_path TO db_manaus');
    console.log('Schema definido: db_manaus');

    // Adicionar colunas na dbitvenda
    console.log('\n--- Adicionando colunas na dbitvenda ---');

    await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_ibs NUMERIC(10,4)');
    console.log('✓ aliquota_ibs adicionada');

    await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_cbs NUMERIC(10,4)');
    console.log('✓ aliquota_cbs adicionada');

    await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_ibs NUMERIC(15,4)');
    console.log('✓ valor_ibs adicionada');

    await client.query('ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_cbs NUMERIC(15,4)');
    console.log('✓ valor_cbs adicionada');

    // Adicionar colunas na dbvenda
    console.log('\n--- Adicionando colunas na dbvenda ---');

    await client.query('ALTER TABLE dbvenda ADD COLUMN IF NOT EXISTS cnpj_empresa VARCHAR(18)');
    console.log('✓ cnpj_empresa adicionada');

    await client.query('ALTER TABLE dbvenda ADD COLUMN IF NOT EXISTS ie_empresa VARCHAR(20)');
    console.log('✓ ie_empresa adicionada');

    console.log('\n✅ Todas as colunas foram criadas com sucesso!');

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

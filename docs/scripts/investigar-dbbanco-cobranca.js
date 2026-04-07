// Script para investigar estrutura da tabela dbbanco_cobranca
const { Pool } = require('pg');

async function investigarTabela() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('📊 Investigando estrutura de dbbanco_cobranca...\n');

    // 1. Ver colunas da tabela
    const colunas = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dbbanco_cobranca'
      ORDER BY ordinal_position;
    `);

    console.log('✅ Colunas encontradas:');
    console.table(colunas.rows);

    // 2. Ver alguns dados de exemplo
    const dados = await client.query('SELECT * FROM dbbanco_cobranca LIMIT 3');
    console.log('\n📋 Dados de exemplo:');
    console.table(dados.rows);

    // 3. Ver foreign keys que referenciam esta tabela
    const fks = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name='dbbanco_cobranca';
    `);

    console.log('\n🔗 Tabelas que referenciam dbbanco_cobranca:');
    console.table(fks.rows);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

investigarTabela();

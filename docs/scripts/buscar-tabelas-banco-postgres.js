const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function buscarTabelasBanco() {
  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Buscar tabelas com "banco" no nome
    const queryTabelas = `
      SELECT 
        schemaname,
        tablename
      FROM pg_tables
      WHERE tablename LIKE '%banco%'
      ORDER BY schemaname, tablename
    `;

    const result = await client.query(queryTabelas);

    console.log(`Encontradas ${result.rows.length} tabelas com "banco" no nome:\n`);
    
    result.rows.forEach(row => {
      console.log(`  ${row.schemaname}.${row.tablename}`);
    });

    // Verificar se existe dbbanco_cobranca (usada no faturamento)
    console.log('\n==========================================');
    console.log('VERIFICANDO DBBANCO_COBRANCA:');
    console.log('==========================================\n');

    const queryBancoCobranca = `
      SELECT banco, nome
      FROM dbbanco_cobranca
      ORDER BY nome
      LIMIT 10
    `;

    const bancos = await client.query(queryBancoCobranca);
    
    console.log(`Total de bancos: ${bancos.rowCount}\n`);
    console.log('Primeiros 10 bancos:');
    bancos.rows.forEach((row, index) => {
      console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${row.banco} - ${row.nome}`);
    });

    console.log('\n✅ Investigação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

buscarTabelasBanco();

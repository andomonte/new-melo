const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function executarMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📦 Executando migration para criar tabelas de tipos de cobrança...');
    
    const sqlPath = path.join(__dirname, 'criar_tabela_tipos_cobranca.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Migration executada com sucesso!');
    
    // Verificar dados inseridos
    const tiposDoc = await client.query('SELECT * FROM db_manaus.dbtipo_documento ORDER BY ordem');
    console.log('\n📄 Tipos de Documento cadastrados:');
    console.table(tiposDoc.rows);
    
    const tiposFat = await client.query('SELECT * FROM db_manaus.dbtipo_fatura ORDER BY ordem');
    console.log('\n📋 Tipos de Fatura cadastrados:');
    console.table(tiposFat.rows);
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executarMigration();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function executarMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Executando migration: add_pagamento_internacional.sql\n');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'migrations', 'add_pagamento_internacional.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar a migration
    await client.query(sql);
    
    console.log('✅ Migration executada com sucesso!\n');
    
    // Verificar as novas colunas
    console.log('📋 Verificando colunas adicionadas em dbpgto:');
    const colunasDbpgto = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbpgto'
        AND column_name IN ('eh_internacional', 'moeda', 'taxa_conversao', 'valor_moeda', 'nro_invoice', 'nro_contrato')
      ORDER BY column_name
    `);
    
    colunasDbpgto.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''})`);
    });
    
    console.log('\n📋 Verificando colunas adicionadas em dbfpgto:');
    const colunasDbfpgto = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfpgto'
        AND column_name IN ('eh_internacional', 'moeda', 'taxa_conversao', 'valor_moeda', 'nro_invoice', 'nro_contrato')
      ORDER BY column_name
    `);
    
    colunasDbfpgto.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''})`);
    });
    
    console.log('\n🎉 Banco de dados atualizado com sucesso!');
    console.log('📝 Próximos passos:');
    console.log('  1. Atualizar a interface de Nova Conta para incluir campos internacionais');
    console.log('  2. Adicionar checkbox "Pagamento Internacional"');
    console.log('  3. Mostrar campos condicionalmente (moeda, taxa, valor em moeda)');
    console.log('  4. Alterar label "Nº NF" para "Nº Invoice" quando internacional');
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

executarMigration();

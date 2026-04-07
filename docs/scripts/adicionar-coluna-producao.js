// Script para adicionar coluna csc_nfce_producao
// Execute: node scripts/adicionar-coluna-producao.js

const { Pool } = require('pg');
require('dotenv').config();

async function adicionarColuna() {
  console.log('🔧 Adicionando coluna csc_nfce_producao...');
  
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    
    try {
      // Adicionar coluna de produção
      await client.query(`
        ALTER TABLE db_manaus.dadosempresa 
        ADD COLUMN IF NOT EXISTS csc_nfce_producao TEXT
      `);
      
      console.log('✅ Coluna csc_nfce_producao adicionada!');
      
      // Verificar se foi criada
      const verificacao = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
          AND table_name = 'dadosempresa' 
          AND column_name LIKE '%csc%'
      `);
      
      console.log('📋 Colunas CSC na tabela:');
      verificacao.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name}`);
      });
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

adicionarColuna().then(() => {
  console.log('🎉 Coluna adicionada com sucesso!');
  console.log('🚀 Agora você pode testar a NFC-e novamente!');
  process.exit(0);
});
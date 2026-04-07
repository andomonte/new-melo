// Script para verificar certificados na tabela dadosempresa
// Execute: node scripts/verificar-certificados.js

const { Pool } = require('pg');
require('dotenv').config();

async function verificarCertificados() {
  console.log('🔍 Verificando certificados na tabela dadosempresa...');
  
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    
    try {
      // Verificar se existem certificados
      const certificados = await client.query(`
        SELECT 
          cgc,
          nomecontribuinte,
          CASE 
            WHEN "certificadoKey" IS NOT NULL AND "certificadoKey" != '' THEN 'Presente'
            ELSE 'Ausente'
          END as certificado_key_status,
          CASE 
            WHEN "certificadoCrt" IS NOT NULL AND "certificadoCrt" != '' THEN 'Presente'
            ELSE 'Ausente'
          END as certificado_crt_status,
          CASE 
            WHEN "cadeiaCrt" IS NOT NULL AND "cadeiaCrt" != '' THEN 'Presente'
            ELSE 'Ausente'
          END as cadeia_crt_status,
          LENGTH("certificadoKey") as key_length,
          LENGTH("certificadoCrt") as crt_length
        FROM db_manaus.dadosempresa
        ORDER BY cgc
      `);
      
      if (certificados.rows.length === 0) {
        console.log('❌ Nenhum registro encontrado na tabela dadosempresa');
        return;
      }
      
      console.log('📋 Status dos certificados:');
      console.table(certificados.rows);
      
      // Verificar qual registro tem certificados
      const comCertificados = certificados.rows.filter(row => 
        row.certificado_key_status === 'Presente' && 
        row.certificado_crt_status === 'Presente'
      );
      
      if (comCertificados.length === 0) {
        console.log('❌ PROBLEMA: Nenhum registro possui certificados válidos!');
        console.log('💡 Você precisa importar os certificados digitais primeiro.');
      } else {
        console.log('✅ Registros com certificados válidos:');
        comCertificados.forEach(reg => {
          console.log(`  - CNPJ: ${reg.cgc.trim()}`);
          console.log(`    Empresa: ${reg.nomecontribuinte}`);
          console.log(`    Key: ${reg.key_length} bytes`);
          console.log(`    Crt: ${reg.crt_length} bytes`);
        });
      }
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verificarCertificados().then(() => {
  console.log('\n🎉 Verificação concluída!');
  process.exit(0);
});
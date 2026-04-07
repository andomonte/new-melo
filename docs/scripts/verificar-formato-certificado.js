#!/usr/bin/env node

// Script para verificar formato dos certificados
// Execute: node scripts/verificar-formato-certificado.js

const { Pool } = require('pg');
require('dotenv').config();

async function verificarFormatoCertificado() {
  console.log('🔍 Verificando formato dos certificados...\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT
          LEFT("certificadoCrt", 100) as cert_preview,
          LEFT("certificadoKey", 100) as key_preview,
          LENGTH("certificadoCrt") as cert_length,
          LENGTH("certificadoKey") as key_length
        FROM db_manaus.dadosempresa
        WHERE "certificadoCrt" IS NOT NULL
          AND "certificadoKey" IS NOT NULL
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        console.log('❌ Nenhum certificado encontrado');
        return;
      }

      const { cert_preview, key_preview, cert_length, key_length } = result.rows[0];

      console.log('📋 CERTIFICADO (.crt):');
      console.log(`📏 Tamanho total: ${cert_length} bytes`);
      console.log('📄 Primeiros 100 caracteres:');
      console.log(cert_preview);
      console.log('');

      console.log('🔑 CHAVE PRIVADA (.key):');
      console.log(`📏 Tamanho total: ${key_length} bytes`);
      console.log('📄 Primeiros 100 caracteres:');
      console.log(key_preview);
      console.log('');

      // Análise do formato
      console.log('🔍 ANÁLISE DO FORMATO:');

      const isPemCert = cert_preview.includes('-----BEGIN CERTIFICATE-----');
      const isPemKey = key_preview.includes('-----BEGIN') && key_preview.includes('PRIVATE KEY-----');

      console.log(`📜 Certificado em formato PEM: ${isPemCert ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`🔐 Chave privada em formato PEM: ${isPemKey ? '✅ SIM' : '❌ NÃO'}`);

      if (!isPemCert || !isPemKey) {
        console.log('');
        console.log('⚠️ PROBLEMA IDENTIFICADO:');
        console.log('Os certificados não estão em formato PEM válido.');
        console.log('');
        console.log('💡 POSSÍVEIS CAUSAS:');
        console.log('1. Certificados foram importados em formato binário (.pfx, .p12)');
        console.log('2. Certificados estão codificados em base64 sem headers PEM');
        console.log('3. Certificados foram corrompidos durante importação');
        console.log('');
        console.log('🔧 SOLUÇÕES:');
        console.log('1. Exportar certificados do Windows em formato PEM');
        console.log('2. Usar openssl para converter:');
        console.log('   openssl pkcs12 -in certificado.pfx -out certificado.pem -nodes');
        console.log('3. Separar chave privada e certificado:');
        console.log('   openssl pkcs12 -in certificado.pfx -nocerts -out chave_privada.pem');
        console.log('   openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out certificado.pem');
      } else {
        console.log('');
        console.log('✅ Formato dos certificados parece correto!');
        console.log('Agora você pode testar a conexão com SEFAZ-AM.');
      }

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    process.exit(1);
  }
}

verificarFormatoCertificado().then(() => {
  console.log('\n🎉 Verificação concluída!');
  process.exit(0);
});
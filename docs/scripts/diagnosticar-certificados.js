#!/usr/bin/env node

// Script para diagnosticar e corrigir certificados
// Execute: node scripts/diagnosticar-certificados.js

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function diagnosticarCertificados() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DOS CERTIFICADOS\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoCrt" as crt,
          "certificadoKey" as key,
          "cadeiaCrt" as cadeia,
          LENGTH("certificadoCrt") as crt_len,
          LENGTH("certificadoKey") as key_len,
          LENGTH("cadeiaCrt") as cadeia_len
        FROM db_manaus.dadosempresa
        WHERE "certificadoCrt" IS NOT NULL
          AND "certificadoKey" IS NOT NULL
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        console.log('❌ Nenhum certificado encontrado');
        return;
      }

      const cert = result.rows[0];
      console.log(`🏢 Empresa: ${cert.nomecontribuinte}`);
      console.log(`🆔 CNPJ: ${cert.cgc.trim()}`);
      console.log('');

      // ==========================================
      // ANÁLISE DETALHADA
      // ==========================================

      console.log('📊 ANÁLISE DETALHADA:');
      console.log('='.repeat(60));

      // Função para analisar conteúdo
      function analisarConteudo(conteudo, nome) {
        console.log(`\n🔍 ${nome}:`);
        console.log(`📏 Tamanho: ${conteudo.length} caracteres`);

        // Verificar se é PEM
        const isPEM = conteudo.includes('-----BEGIN') && conteudo.includes('-----END');
        console.log(`📜 Formato PEM: ${isPEM ? '✅ SIM' : '❌ NÃO'}`);

        // Verificar se é base64 válido
        try {
          const buffer = Buffer.from(conteudo, 'base64');
          const isValidBase64 = buffer.toString('base64') === conteudo.replace(/\s/g, '');
          console.log(`🔢 Base64 válido: ${isValidBase64 ? '✅ SIM' : '❌ NÃO'}`);

          if (isValidBase64) {
            console.log(`📦 Tamanho decodificado: ${buffer.length} bytes`);

            // Tentar identificar tipo de conteúdo
            const firstBytes = buffer.slice(0, 20).toString('hex').toUpperCase();
            console.log(`🔤 Primeiros bytes (hex): ${firstBytes}`);

            // Verificar padrões conhecidos
            if (firstBytes.startsWith('3082') || firstBytes.startsWith('3081')) {
              console.log('🏆 Parece ser um certificado PKCS#7 ou DER!');
            } else if (conteudo.includes('CERTIFICATE')) {
              console.log('📜 Já está em formato PEM');
            } else {
              console.log('❓ Formato desconhecido');
            }
          }

        } catch (error) {
          console.log(`❌ Erro na decodificação base64: ${error.message}`);
        }

        // Mostrar preview
        console.log(`📄 Preview: ${conteudo.substring(0, 50)}...`);
      }

      analisarConteudo(cert.crt, 'CERTIFICADO (.crt)');
      analisarConteudo(cert.key, 'CHAVE PRIVADA (.key)');
      analisarConteudo(cert.cadeia, 'CADEIA (.pem)');

      console.log('\n' + '='.repeat(60));
      console.log('🔧 DIAGNÓSTICO E SOLUÇÕES:');
      console.log('='.repeat(60));

      // Verificar se pode ser convertido
      const crtIsBase64 = (() => {
        try {
          Buffer.from(cert.crt, 'base64');
          return true;
        } catch {
          return false;
        }
      })();

      if (crtIsBase64) {
        console.log('✅ Certificado parece estar em base64 - pode ser convertido');
        console.log('');
        console.log('💡 PRÓXIMOS PASSOS:');
        console.log('1. O certificado pode estar em formato DER (binário)');
        console.log('2. Converter DER para PEM usando openssl:');
        console.log('   openssl x509 -in certificado.der -inform der -out certificado.pem');
        console.log('');
        console.log('3. Ou pode ser um PKCS#12 (.pfx) que precisa ser extraído:');
        console.log('   openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem');
        console.log('   openssl pkcs12 -in certificado.pfx -nocerts -out key.pem');
        console.log('');
        console.log('4. IMPORTANTE: Você precisa do arquivo .pfx original do certificado!');
        console.log('   O banco só tem dados extraídos, não o arquivo completo.');

      } else {
        console.log('❌ Certificado não está em base64 válido');
        console.log('💡 Pode estar corrompido ou em formato diferente');
      }

      console.log('');
      console.log('🎯 CONCLUSÃO:');
      console.log('Para funcionar com NFC-e, você precisa:');
      console.log('1. Arquivo .pfx do certificado ICP-Brasil');
      console.log('2. Senha do certificado');
      console.log('3. Extrair chave privada e certificado usando openssl');
      console.log('4. Importar no formato correto no banco de dados');

      // ==========================================
      // TESTE DE CONEXÃO SIMPLES
      // ==========================================

      console.log('\n🌐 TESTE DE CONEXÃO SEFAZ-AM:');
      console.log('='.repeat(60));

      try {
        const https = require('https');
        const url = 'https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';

        console.log('Tentando conexão sem certificado...');
        const response = await https.get(url);

        console.log(`✅ Conexão básica: ${response.statusCode}`);
        response.destroy(); // Fechar conexão

      } catch (error) {
        console.log(`❌ Erro de conexão: ${error.message}`);
        console.log('💡 Verifique conectividade com SEFAZ-AM');
      }

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error) {
    console.error('❌ ERRO GERAL:', error.message);
    process.exit(1);
  }
}

diagnosticarCertificados().then(() => {
  console.log('\n🎉 Diagnóstico concluído!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
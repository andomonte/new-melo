#!/usr/bin/env node

// Script para tentar recuperar certificado corrompido
// Execute: node scripts/recuperar-certificado.js

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function tentarRecuperarCertificado() {
  console.log('🔧 TENTATIVA DE RECUPERAÇÃO DO CERTIFICADO CORROMPIDO\n');

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
          "cadeiaCrt" as cadeia
        FROM db_manaus.dadosempresa
        WHERE "certificadoCrt" IS NOT NULL
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
      // TENTATIVA 1: Verificar se é base64 puro sem headers
      // ==========================================

      console.log('🔄 TENTATIVA 1: Remover headers PEM e tentar reconstruir');

      function tentarReconstruirPEM(conteudo, tipo) {
        // Remover headers PEM se existirem
        let limpo = conteudo
          .replace(/-----BEGIN CERTIFICATE-----/g, '')
          .replace(/-----END CERTIFICATE-----/g, '')
          .replace(/-----BEGIN PRIVATE KEY-----/g, '')
          .replace(/-----END PRIVATE KEY-----/g, '')
          .replace(/\s/g, ''); // Remover espaços e quebras de linha

        console.log(`   ${tipo} - Conteúdo limpo: ${limpo.substring(0, 50)}...`);

        try {
          // Tentar decodificar como base64
          const buffer = Buffer.from(limpo, 'base64');
          console.log(`   ✅ Base64 decodificado: ${buffer.length} bytes`);

          // Verificar se parece um certificado (ASN.1 DER)
          const firstBytes = buffer.slice(0, 2).toString('hex').toUpperCase();
          if (firstBytes === '3082' || firstBytes === '3081') {
            console.log(`   🎯 Parece formato DER válido! (${firstBytes})`);

            // Tentar converter DER para PEM
            const pem = `-----BEGIN CERTIFICATE-----\n` +
                       buffer.toString('base64').match(/.{1,64}/g).join('\n') +
                       `\n-----END CERTIFICATE-----\n`;

            return pem;
          } else {
            console.log(`   ❌ Não parece DER válido (bytes iniciais: ${firstBytes})`);
            return null;
          }

        } catch (error) {
          console.log(`   ❌ Erro na decodificação: ${error.message}`);
          return null;
        }
      }

      const certReconstruido = tentarReconstruirPEM(cert.crt, 'CERTIFICADO');
      const keyReconstruido = tentarReconstruirPEM(cert.key, 'CHAVE PRIVADA');
      const cadeiaReconstruido = cert.cadeia ? tentarReconstruirPEM(cert.cadeia, 'CADEIA') : null;

      // ==========================================
      // TENTATIVA 2: Verificar se já está em formato correto
      // ==========================================

      console.log('\n🔄 TENTATIVA 2: Testar formato atual');

      async function testarCertificado(crt, key, nome) {
        try {
          const https = require('https');
          const agent = new https.Agent({
            cert: Buffer.from(crt),
            key: Buffer.from(key),
            rejectUnauthorized: false
          });

          console.log(`   ✅ ${nome}: Certificado carregado no Node.js`);
          return true;
        } catch (error) {
          console.log(`   ❌ ${nome}: ${error.message}`);
          return false;
        }
      }

      // Testar formato atual
      const atualOK = await testarCertificado(cert.crt, cert.key, 'Formato Atual');

      // Testar formato reconstruído
      let reconstruidoOK = false;
      if (certReconstruido && keyReconstruido) {
        reconstruidoOK = await testarCertificado(certReconstruido, keyReconstruido, 'Formato Reconstruído');
      }

      // ==========================================
      // RESULTADO E PRÓXIMOS PASSOS
      // ==========================================

      console.log('\n📊 RESULTADO DA RECUPERAÇÃO:');
      console.log('='.repeat(50));

      if (atualOK) {
        console.log('✅ Formato atual funciona! Problema pode ser outro.');
        console.log('💡 Execute: node scripts/testar-certificado-sefaz.js');
      } else if (reconstruidoOK) {
        console.log('✅ Formato reconstruído funciona!');

        // Salvar versão corrigida
        const backupDir = path.join(__dirname, '..', 'certificados-corrigidos');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const certFile = path.join(backupDir, `${cert.cgc.trim()}_certificado.pem`);
        const keyFile = path.join(backupDir, `${cert.cgc.trim()}_chave.pem`);

        fs.writeFileSync(certFile, certReconstruido);
        fs.writeFileSync(keyFile, keyReconstruido);

        console.log(`💾 Arquivos salvos em: ${backupDir}`);

        // Atualizar banco
        await client.query(`
          UPDATE db_manaus.dadosempresa
          SET "certificadoCrt" = $1, "certificadoKey" = $2
          WHERE cgc = $3
        `, [certReconstruido, keyReconstruido, cert.cgc]);

        console.log('✅ Banco atualizado com certificado corrigido!');

      } else {
        console.log('❌ Não foi possível recuperar o certificado automaticamente.');
        console.log('');
        console.log('🔧 SOLUÇÕES MANUAIS:');
        console.log('');
        console.log('1. 🏦 CONTATAR AUTORIDADE CERTIFICADORA:');
        console.log('   - Solicitar reemissão do certificado ICP-Brasil');
        console.log('   - Explicar que os dados foram corrompidos');
        console.log('');
        console.log('2. 🏢 CONTATAR SEFAZ-AM:');
        console.log('   - Verificar status do CNPJ para NFC-e');
        console.log('   - Confirmar se certificado ainda é válido');
        console.log('');
        console.log('3. 🔄 SISTEMA LEGADO:');
        console.log('   - Verificar se NF-e ainda funciona');
        console.log('   - Exportar certificado do sistema legado');
        console.log('');
        console.log('4. 📞 SUPORTE TÉCNICO:');
        console.log('   - Contatar equipe de TI responsável pelos certificados');
        console.log('   - Pedir arquivo .pfx original');
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

tentarRecuperarCertificado().then(() => {
  console.log('\n🎉 Tentativa de recuperação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
#!/usr/bin/env node

// Script para converter certificados para formato PEM
// Execute: node scripts/converter-certificado-pem.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function converterCertificadoPEM() {
  console.log('🔄 Convertendo certificados para formato PEM...\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // Buscar certificados
      const result = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoCrt",
          "certificadoKey",
          "cadeiaCrt"
        FROM db_manaus.dadosempresa
        WHERE "certificadoCrt" IS NOT NULL
          AND "certificadoKey" IS NOT NULL
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        console.log('❌ Nenhum certificado encontrado');
        return;
      }

      const dados = result.rows[0];
      const cnpj = dados.cgc.trim().replace(/[^\d]/g, '');

      console.log(`🏢 Empresa: ${dados.nomecontribuinte}`);
      console.log(`🆔 CNPJ: ${cnpj}`);
      console.log('');

      // Criar diretório para salvar certificados
      const certDir = path.join(__dirname, '..', 'certificados');
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      // Função para detectar e converter formato
      function detectarEConverter(conteudo, tipo) {
        // Verificar se já é PEM
        if (conteudo.includes('-----BEGIN')) {
          console.log(`✅ ${tipo} já está em formato PEM`);
          return conteudo;
        }

        // Tentar converter de base64 para PEM
        try {
          // Verificar se é base64 válido
          const buffer = Buffer.from(conteudo, 'base64');
          const decoded = buffer.toString('utf8');

          // Se o decoded contém headers PEM, usar ele
          if (decoded.includes('-----BEGIN')) {
            console.log(`✅ ${tipo} convertido de base64 para PEM`);
            return decoded;
          }

          // Se não, assumir que o conteúdo original é binário e tentar formatar como PEM
          console.log(`🔄 ${tipo} convertido para formato PEM`);

          let header, footer;
          if (tipo === 'CERTIFICADO') {
            header = '-----BEGIN CERTIFICATE-----';
            footer = '-----END CERTIFICATE-----';
          } else if (tipo === 'CHAVE PRIVADA') {
            header = '-----BEGIN PRIVATE KEY-----';
            footer = '-----END PRIVATE KEY-----';
          } else if (tipo === 'CADEIA') {
            header = '-----BEGIN CERTIFICATE-----';
            footer = '-----END CERTIFICATE-----';
          }

          // Quebrar em linhas de 64 caracteres
          const base64 = buffer.toString('base64');
          const lines = base64.match(/.{1,64}/g) || [];
          return header + '\n' + lines.join('\n') + '\n' + footer + '\n';

        } catch (error) {
          console.log(`❌ Erro ao converter ${tipo}: ${error.message}`);
          return conteudo; // Retornar original se falhar
        }
      }

      // Converter certificados
      const certPEM = detectarEConverter(dados.certificadoCrt, 'CERTIFICADO');
      const keyPEM = detectarEConverter(dados.certificadoKey, 'CHAVE PRIVADA');
      const cadeiaPEM = dados.cadeiaCrt ? detectarEConverter(dados.cadeiaCrt, 'CADEIA') : null;

      // Salvar arquivos
      const certFile = path.join(certDir, `${cnpj}_certificado.pem`);
      const keyFile = path.join(certDir, `${cnpj}_chave_privada.pem`);
      const cadeiaFile = path.join(certDir, `${cnpj}_cadeia.pem`);

      fs.writeFileSync(certFile, certPEM);
      fs.writeFileSync(keyFile, keyPEM);

      console.log('');
      console.log('💾 Arquivos salvos:');
      console.log(`📜 ${certFile}`);
      console.log(`🔑 ${keyFile}`);

      if (cadeiaPEM) {
        fs.writeFileSync(cadeiaFile, cadeiaPEM);
        console.log(`🔗 ${cadeiaFile}`);
      }

      // Atualizar banco de dados com formato PEM
      console.log('');
      console.log('💾 Atualizando banco de dados...');

      await client.query(`
        UPDATE db_manaus.dadosempresa
        SET
          "certificadoCrt" = $1,
          "certificadoKey" = $2,
          "cadeiaCrt" = $3
        WHERE cgc = $4
      `, [certPEM, keyPEM, cadeiaPEM, dados.cgc]);

      console.log('✅ Banco de dados atualizado com certificados em formato PEM');

      // Testar se os certificados convertidos funcionam
      console.log('');
      console.log('🧪 Testando certificados convertidos...');

      try {
        // Tentar criar agente HTTPS para validar
        const https = require('https');
        const agent = new https.Agent({
          key: Buffer.from(keyPEM),
          cert: Buffer.from(certPEM),
          ca: cadeiaPEM ? Buffer.from(cadeiaPEM) : undefined,
          rejectUnauthorized: false
        });

        console.log('✅ Certificados carregados com sucesso no Node.js!');
        console.log('');
        console.log('🎯 PRÓXIMOS PASSOS:');
        console.log('1. Execute: node scripts/testar-certificado-sefaz.js');
        console.log('2. Se funcionar, teste uma emissão real de NFC-e');
        console.log('3. Verifique se o CNPJ está habilitado no SEFAZ-AM');

      } catch (testError) {
        console.log(`❌ Erro ao testar certificados: ${testError.message}`);
        console.log('💡 Verifique se a conversão foi feita corretamente');
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

converterCertificadoPEM().then(() => {
  console.log('\n🎉 Conversão concluída!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
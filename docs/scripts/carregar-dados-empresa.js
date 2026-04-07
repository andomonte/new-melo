#!/usr/bin/env node

// Script para carregar e analisar dados da empresa e certificado digital
// Execute: node scripts/carregar-dados-empresa.js

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

async function carregarDadosEmpresa() {
  console.log('🏢 Carregando dados da empresa e analisando certificado digital...\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // Buscar dados da empresa com certificados
      const empresa = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          inscricaoestadual,
          logradouro,
          numero,
          complemento,
          bairro,
          municipio,
          uf,
          cep,
          telefone,
          email,
          contato,
          fax,
          "certificadoKey",
          "certificadoCrt",
          "cadeiaCrt",
          LENGTH("certificadoKey") as key_length,
          LENGTH("certificadoCrt") as crt_length,
          LENGTH("cadeiaCrt") as cadeia_length
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoCrt" IS NOT NULL
          AND "certificadoKey" != ''
          AND "certificadoCrt" != ''
        LIMIT 1
      `);

      if (empresa.rows.length === 0) {
        console.log('❌ ERRO: Nenhum certificado encontrado na tabela dadosempresa');
        console.log('💡 Você precisa importar o certificado digital primeiro.');
        return;
      }

      const dados = empresa.rows[0];

      console.log('📋 DADOS DA EMPRESA:');
      console.log('=' .repeat(60));
      console.log(`🏢 Razão Social: ${dados.nomecontribuinte}`);
      console.log(`🆔 CNPJ: ${dados.cgc.trim()}`);
      console.log(`📋 IE: ${dados.inscricaoestadual || 'Não informado'}`);
      console.log(`📍 Endereço: ${dados.logradouro}, ${dados.numero}${dados.complemento ? ', ' + dados.complemento : ''}`);
      console.log(`🏘️ Bairro: ${dados.bairro}`);
      console.log(`🏙️ Cidade: ${dados.municipio} - ${dados.uf}`);
      console.log(`📮 CEP: ${dados.cep}`);
      console.log(`📞 Telefone: ${dados.telefone || 'Não informado'}`);
      console.log(`📧 Email: ${dados.email || 'Não informado'}`);
      console.log(`👤 Contato: ${dados.contato || 'Não informado'}`);
      console.log(`📠 Fax: ${dados.fax || 'Não informado'}`);
      console.log('');

      console.log('🔐 CERTIFICADO DIGITAL:');
      console.log('=' .repeat(60));

      // Analisar certificado
      try {
        const certificado = dados.certificadoCrt;
        const chavePrivada = dados.certificadoKey;
        const cadeia = dados.cadeiaCrt;

        console.log(`📏 Tamanho da chave privada: ${dados.key_length} bytes`);
        console.log(`📏 Tamanho do certificado: ${dados.crt_length} bytes`);
        console.log(`📏 Tamanho da cadeia: ${dados.cadeia_length || 0} bytes`);
        console.log('');

        // Tentar fazer parse do certificado (formato PEM)
        if (certificado.includes('-----BEGIN CERTIFICATE-----')) {
          console.log('✅ Certificado em formato PEM válido');

          // Extrair informações básicas do certificado
          const certLines = certificado.split('\n');
          const certData = certLines.slice(1, -2).join(''); // Remover headers/footer

          try {
            // Decodificar base64 para obter dados ASN.1
            const certBuffer = Buffer.from(certData, 'base64');

            // Calcular fingerprint SHA-1
            const sha1Fingerprint = crypto.createHash('sha1').update(certBuffer).digest('hex').toUpperCase();
            const sha1Formatted = sha1Fingerprint.match(/.{2}/g).join(':');

            console.log(`🔑 SHA-1 Fingerprint: ${sha1Formatted}`);

            // Calcular fingerprint SHA-256
            const sha256Fingerprint = crypto.createHash('sha256').update(certBuffer).digest('hex').toUpperCase();
            const sha256Formatted = sha256Fingerprint.match(/.{2}/g).join(':');

            console.log(`🔑 SHA-256 Fingerprint: ${sha256Formatted}`);

          } catch (parseError) {
            console.log('⚠️ Não foi possível fazer parse detalhado do certificado');
            console.log(`   Erro: ${parseError.message}`);
          }

        } else {
          console.log('⚠️ Certificado pode não estar em formato PEM padrão');
        }

        // Verificar se tem cadeia de certificação
        if (cadeia && cadeia.trim()) {
          console.log('✅ Cadeia de certificação presente');
        } else {
          console.log('⚠️ Cadeia de certificação ausente');
        }

        console.log('');

        // Verificar validade aproximada (data atual vs expiração)
        console.log('📅 VALIDADE DO CERTIFICADO:');
        console.log('=' .repeat(60));

        // Nota: Para análise completa de validade, seria necessário usar biblioteca específica
        // como node-forge ou openssl. Por enquanto, apenas verificamos se existe.
        console.log('📋 Para verificar a validade completa, use:');
        console.log('   openssl x509 -in certificado.crt -text -noout');
        console.log('');

        // Verificar habilitação para NFC-e
        console.log('🎯 HABILITAÇÃO PARA NFC-E:');
        console.log('=' .repeat(60));

        const cnpj = dados.cgc.trim().replace(/[^\d]/g, '');
        console.log(`🆔 CNPJ analisado: ${cnpj}`);

        if (cnpj === '18053139000169') {
          console.log('✅ CNPJ corresponde ao esperado para homologação');
          console.log('📍 Estado: Amazonas (AM)');
          console.log('🏛️ SEFAZ: SEFAZ-AM (Secretaria da Fazenda do Amazonas)');
          console.log('');
          console.log('🔍 STATUS DE HABILITAÇÃO:');
          console.log('Para confirmar se está habilitado para NFC-e, você precisa:');
          console.log('1. Acessar o portal da SEFAZ-AM: https://www.sefaz.am.gov.br');
          console.log('2. Verificar status do contribuinte no ambiente de homologação');
          console.log('3. Confirmar se o certificado ICP-Brasil está válido');
          console.log('4. Testar emissão em homologação antes de produção');
          console.log('');
          console.log('🧪 TESTE DE CONEXÃO:');
          console.log('Para testar se o certificado funciona:');
          console.log('   node scripts/testar-certificado-sefaz.js');
        } else {
          console.log('⚠️ CNPJ diferente do esperado para homologação');
          console.log('💡 Verifique se este é o CNPJ correto para testes');
        }

      } catch (certError) {
        console.log('❌ ERRO ao analisar certificado:');
        console.log(`   ${certError.message}`);
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

// Executar função principal
carregarDadosEmpresa().then(() => {
  console.log('\n🎉 Análise concluída!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
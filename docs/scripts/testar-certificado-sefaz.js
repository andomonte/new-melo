#!/usr/bin/env node

// Script para testar certificado digital com SEFAZ-AM
// Execute: node scripts/testar-certificado-sefaz.js

const { Pool } = require('pg');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function testarCertificadoSefaz() {
  console.log('🔐 Testando certificado digital com SEFAZ-AM...\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // Buscar certificado da empresa
      const empresa = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoKey",
          "certificadoCrt",
          "cadeiaCrt"
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoCrt" IS NOT NULL
          AND "certificadoKey" != ''
          AND "certificadoCrt" != ''
        LIMIT 1
      `);

      if (empresa.rows.length === 0) {
        console.log('❌ ERRO: Nenhum certificado encontrado');
        return;
      }

      const dados = empresa.rows[0];
      console.log(`🏢 Empresa: ${dados.nomecontribuinte}`);
      console.log(`🆔 CNPJ: ${dados.cgc.trim()}`);
      console.log('');

      // Configurar agente HTTPS com certificado
      const agent = new https.Agent({
        key: Buffer.from(dados.certificadoKey),
        cert: Buffer.from(dados.certificadoCrt),
        ca: dados.cadeiaCrt ? Buffer.from(dados.cadeiaCrt) : undefined,
        rejectUnauthorized: false, // Para testes, aceita certificados auto-assinados
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        timeout: 30000
      });

      // URL de teste SEFAZ-AM Homologação
      const urlTeste = 'https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';

      console.log('🌐 Testando conexão HTTPS com certificado...');
      console.log(`🔗 URL: ${urlTeste}`);

      try {
        // Fazer uma requisição HEAD para testar conectividade
        const response = await axios.head(urlTeste, {
          httpsAgent: agent,
          timeout: 30000,
          headers: {
            'User-Agent': 'Sistema-Melo-Teste/1.0'
          }
        });

        console.log('✅ CONEXÃO HTTPS BEM-SUCEDIDA!');
        console.log(`📊 Status HTTP: ${response.status}`);
        console.log(`📋 Resposta: ${response.statusText}`);

        // Agora testar com uma requisição SOAP mínima
        console.log('\n🧪 Testando requisição SOAP mínima...');

        const envelopeSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeAutorizacaoLote xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <nfeDadosMsg>
        <teste>Teste de conectividade</teste>
      </nfeDadosMsg>
    </nfeAutorizacaoLote>
  </soap:Body>
</soap:Envelope>`;

        const soapResponse = await axios.post(urlTeste, envelopeSoap, {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
            'User-Agent': 'Sistema-Melo-Teste/1.0'
          },
          timeout: 30000
        });

        console.log('✅ REQUISIÇÃO SOAP BEM-SUCEDIDA!');
        console.log(`📊 Status HTTP: ${soapResponse.status}`);

        if (soapResponse.data) {
          console.log('📋 Resposta SEFAZ (preview):', soapResponse.data.substring(0, 200) + '...');

          // Verificar se é erro de autenticação ou sucesso
          if (soapResponse.data.includes('Rejeicao') || soapResponse.data.includes('Erro')) {
            console.log('\n⚠️ RESPOSTA SEFAZ (pode indicar problema de autenticação):');
            const erroMatch = soapResponse.data.match(/<xMotivo>(.*?)<\/xMotivo>/);
            if (erroMatch) {
              console.log(`💬 Motivo: ${erroMatch[1]}`);
            }
          } else {
            console.log('\n✅ Certificado parece válido para comunicação com SEFAZ!');
          }
        }

      } catch (httpError) {
        console.log('\n❌ ERRO na requisição HTTPS:');
        console.log(`📊 Status: ${httpError.response?.status || 'N/A'}`);
        console.log(`💬 Mensagem: ${httpError.message}`);

        if (httpError.response?.data) {
          console.log('📋 Resposta de erro (preview):', httpError.response.data.substring(0, 300) + '...');
        }

        // Analisar possíveis causas
        console.log('\n🔍 ANÁLISE DO ERRO:');

        if (httpError.code === 'ECONNREFUSED') {
          console.log('🚫 Conexão recusada - verificar URL ou firewall');
        } else if (httpError.code === 'CERT_HAS_EXPIRED') {
          console.log('⏰ Certificado expirado');
        } else if (httpError.code === 'ENOTFOUND') {
          console.log('🌐 Host não encontrado - verificar DNS');
        } else if (httpError.response?.status === 400) {
          console.log('📝 Erro 400 - problema na requisição (certificado ou dados)');
        } else if (httpError.response?.status === 403) {
          console.log('🚫 Erro 403 - certificado não autorizado');
        } else if (httpError.response?.status === 500) {
          console.log('💥 Erro 500 - problema no servidor SEFAZ');
        } else {
          console.log('❓ Erro não identificado - verificar logs detalhados');
        }
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
testarCertificadoSefaz().then(() => {
  console.log('\n🎉 Teste de certificado concluído!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
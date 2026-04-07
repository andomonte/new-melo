// Script para testar NFC-e completo com envelope simples
// Sem enviNFe, apenas o XML da NFC-e diretamente

const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const { Client } = require('pg');
const fs = require('fs');

// Configuração do banco
const dbConfig = {
  connectionString: process.env.DATABASE_URL_MANAUS || "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15"
};

// Função de descriptografia
async function decrypt(encryptedText) {
  if (!encryptedText) return null;
  if (!encryptedText.includes('.')) return encryptedText;

  const parts = encryptedText.split('.');
  if (parts.length !== 3) return null;

  const [encrypted, saltBase64, ivBase64] = parts;
  const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || 'e36f65cda1cfadae83028a78a8c8b2e62f82677e5953c4ed7d186c5aed10fc62';
  const salt = Buffer.from(saltBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');

  const key = await deriveKeyFromMaster(CRYPTO_MASTER_KEY, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function deriveKeyFromMaster(masterKey, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(masterKey, salt, 100000, 32, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey);
    });
  });
}

class SimpleCompleteNFCeTester {
  constructor() {
    this.client = new Client(dbConfig);
    this.certificadoKey = null;
    this.certificadoCrt = null;
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async loadCertificates() {
    const query = `
      SELECT "certificadoKey", "certificadoCrt"
      FROM db_manaus.dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoKey" != ''
        AND "certificadoCrt" IS NOT NULL AND "certificadoCrt" != ''
      LIMIT 1
    `;

    const result = await this.client.query(query);
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    this.certificadoKey = await decrypt(row.certificadoKey);
    this.certificadoCrt = await decrypt(row.certificadoCrt);

    return !!(this.certificadoKey && this.certificadoCrt);
  }

  // Criar envelope SOAP NFC-e simples
  createSOAPEnvelope(xmlAssinado) {
    // Envelope simples para NFC-e - apenas o XML da NFC-e
    const xmlSemDeclaracao = xmlAssinado.replace(/<\?xml[^>]*\?>/, '').trim();

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Header>
<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4">
<cUF>13</cUF>
<versaoDados>4.00</versaoDados>
</nfeCabecMsg>
</soap12:Header>
<soap12:Body>
<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4">
${xmlSemDeclaracao}
</nfeDadosMsg>
</soap12:Body>
</soap12:Envelope>`;
  }

  // Criar agente HTTPS
  createHttpsAgent() {
    return new https.Agent({
      key: Buffer.from(this.certificadoKey),
      cert: Buffer.from(this.certificadoCrt),
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      timeout: 30000
    });
  }

  // Headers da requisição
  getHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'Keep-Alive'
    };
  }

  // Testar NFC-e completo
  async testCompleteNFCe() {
    console.log('🚀 TESTE NFC-e SIMPLES SEM enviNFe');
    console.log('==================================');

    try {
      await this.connect();

      if (!(await this.loadCertificates())) {
        console.log('❌ Certificados não carregados');
        return;
      }

      console.log('✅ Certificados carregados');

      // Carregar XML assinado do arquivo (usar o válido)
      if (!fs.existsSync('nfce-valido-assinado.xml')) {
        console.log('❌ Arquivo nfce-valido-assinado.xml não encontrado');
        console.log('💡 Execute primeiro: node scripts/generate-valid-nfce.js');
        return;
      }

      const xmlAssinado = fs.readFileSync('nfce-valido-assinado.xml', 'utf8');
      console.log(`📄 XML assinado carregado: ${xmlAssinado.length} caracteres`);

      // Verificar se tem assinatura
      const hasSignature = xmlAssinado.includes('<Signature');
      console.log(`🔐 Tem assinatura: ${hasSignature ? '✅' : '❌'}`);

      if (!hasSignature) {
        console.log('❌ XML não está assinado - abortando');
        return;
      }

      // Criar envelope SOAP simples
      const envelope = this.createSOAPEnvelope(xmlAssinado);
      console.log(`📏 Envelope SOAP simples: ${envelope.length} caracteres`);

      // Salvar envelope
      fs.writeFileSync('envelope-simples.xml', envelope);
      console.log('💾 Envelope salvo em: envelope-simples.xml');

      // Preparar requisição
      const url = 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
      console.log(`🌐 URL: ${url}`);

      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      console.log('🌐 Enviando NFC-e para SEFAZ-AM...');

      const response = await axios.post(url, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ NFC-e ENVIADO COM SUCESSO!');
      console.log(`📊 Status HTTP: ${response.status}`);

      // Analisar resposta
      this.analyzeResponse(response.data);

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      console.log('❌ NFC-e FALHOU');
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`🔍 Código do erro: ${error.code || 'N/A'}`);
      console.log(`📝 Mensagem: ${error.message}`);

      if (error.response?.data) {
        console.log(`📄 Resposta do servidor: ${error.response.data.substring(0, 500)}...`);
      }

      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        code: error.code,
        response: error.response?.data
      };
    } finally {
      await this.disconnect();
    }
  }

  // Analisar resposta
  analyzeResponse(responseData) {
    console.log(`\n📊 ANÁLISE DA RESPOSTA NFC-e:`);
    console.log('='.repeat(30));

    try {
      const statusMatch = responseData.match(/<cStat>(\d+)<\/cStat>/);
      const motivoMatch = responseData.match(/<xMotivo>([^<]+)<\/xMotivo>/);

      if (statusMatch) {
        const cStat = statusMatch[1];
        console.log(`📊 Código do Status: ${cStat}`);

        this.interpretStatusCode(cStat);
      }

      if (motivoMatch) {
        console.log(`📝 Motivo: ${motivoMatch[1]}`);
      }

      const isAuthorized = statusMatch && statusMatch[1] === '100';
      console.log(`🚦 Resultado: ${isAuthorized ? '✅ AUTORIZADA' : '❌ REJEITADA'}`);

    } catch (error) {
      console.log(`❌ Erro ao analisar resposta: ${error.message}`);
      console.log('📄 Resposta bruta:', responseData.substring(0, 500));
    }
  }

  // Interpretar código de status
  interpretStatusCode(cStat) {
    const statusCodes = {
      '100': '✅ Autorizado o uso da NF-e',
      '101': '✅ Cancelamento de NF-e homologado',
      '102': '✅ Inutilização de número homologado',
      '103': '✅ Lote recebido com sucesso',
      '104': '✅ Lote processado',
      '105': '✅ Lote em processamento',
      '106': '✅ Lote não localizado',
      '107': '✅ Serviço em Operação',
      '108': '⚠️ Serviço Paralisado Temporariamente',
      '109': '❌ Serviço Paralisado',
      '110': '❓ Status Indisponível',
      '201': '❌ Rejeição: Número da NF-e já existente',
      '202': '❌ Rejeição: NF-e já existente',
      '203': '❌ Rejeição: NF-e não existe',
      '204': '❌ Rejeição: Duplicidade de NF-e',
      '205': '❌ Rejeição: NF-e está denegada',
      '301': '❌ Rejeição: Uso Denegado',
      '302': '❌ Rejeição: Irregularidade fiscal do emitente',
      '303': '❌ Rejeição: Destinatário não habilitado',
      '401': '❌ Rejeição: CPF/CNPJ do emitente inválido',
      '402': '❌ Rejeição: CPF/CNPJ do destinatário inválido'
    };

    const description = statusCodes[cStat] || `🔍 Código ${cStat} - Verificar documentação`;
    console.log(`🔍 Interpretação: ${description}`);
  }

  // Executar teste
  async runTest() {
    const result = await this.testCompleteNFCe();

    console.log('\n🎯 RESULTADO FINAL:');
    console.log('===================');

    if (result.success) {
      console.log('✅ NFC-e autorizada com sucesso!');
      console.log('🎉 Problema resolvido - código de produção deve funcionar');
    } else if (result.status === 500) {
      console.log('❌ Erro 500 - Problema no XML/envelope');
      console.log('💡 Verificar envelope-simples.xml para detalhes');
    } else if (result.status === 404) {
      console.log('❌ Erro 404 - Endpoint incorreto');
      console.log('💡 Verificar URL do SEFAZ-AM');
    } else {
      console.log(`❌ Erro ${result.status} - Verificar resposta detalhada`);
    }

    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. 🔍 Comparar envelope-simples.xml com produção');
    console.log('   2. 📄 Verificar se assinatura está correta');
    console.log('   3. 🎫 Testar CSC e QR code');
    console.log('   4. 📞 Contatar SEFAZ-AM se necessário');

    return result;
  }
}

// Executar teste
async function main() {
  const tester = new SimpleCompleteNFCeTester();
  await tester.runTest();
}

if (require.main === module) {
  main();
}
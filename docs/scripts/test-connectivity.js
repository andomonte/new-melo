// Script simples para testar apenas conectividade SEFAZ-AM
// Sem enviar dados, apenas verificar se endpoint responde

const https = require('https');
const axios = require('axios');
const { Client } = require('pg');
const crypto = require('crypto');

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

class ConnectivityTester {
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
      WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
      LIMIT 1
    `;

    const result = await this.client.query(query);
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    this.certificadoKey = await decrypt(row.certificadoKey);
    this.certificadoCrt = await decrypt(row.certificadoCrt);

    return !!(this.certificadoKey && this.certificadoCrt);
  }

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

  // Testar diferentes endpoints
  async testEndpoint(url, description) {
    console.log(`\n🌐 TESTANDO: ${description}`);
    console.log(`📍 URL: ${url}`);

    try {
      const agent = this.createHttpsAgent();
      const response = await axios.get(url, {
        httpsAgent: agent,
        timeout: 10000,
        validateStatus: () => true // Aceitar qualquer status
      });

      console.log(`📊 Status HTTP: ${response.status}`);
      console.log(`📏 Resposta: ${response.data.substring(0, 100)}...`);

      return { success: response.status < 400, status: response.status };

    } catch (error) {
      console.log(`❌ Erro: ${error.code || 'UNKNOWN'}`);
      console.log(`📝 Mensagem: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Executar testes de conectividade
  async runConnectivityTests() {
    console.log('🔗 TESTE DE CONECTIVIDADE SEFAZ-AM');
    console.log('==================================');

    try {
      await this.connect();

      if (!(await this.loadCertificates())) {
        console.log('❌ Certificados não encontrados');
        return;
      }

      console.log('✅ Certificados carregados');

      // Testar endpoints NFC-e
      const endpoints = [
        {
          url: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
          desc: 'NFC-e Homologação - Autorização'
        },
        {
          url: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
          desc: 'NFC-e Produção - Autorização'
        },
        {
          url: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
          desc: 'NFC-e Homologação - Status'
        },
        {
          url: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
          desc: 'NFC-e Produção - Status'
        },
        // Testar NF-e também
        {
          url: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
          desc: 'NF-e Homologação - Autorização'
        },
        {
          url: 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
          desc: 'NF-e Produção - Autorização'
        }
      ];

      const results = [];
      for (const endpoint of endpoints) {
        const result = await this.testEndpoint(endpoint.url, endpoint.desc);
        results.push({ ...endpoint, ...result });
      }

      // Resumo
      this.printSummary(results);

    } catch (error) {
      console.error('❌ Erro nos testes:', error.message);
    } finally {
      await this.disconnect();
    }
  }

  printSummary(results) {
    console.log('\n📊 RESUMO DOS TESTES');
    console.log('====================');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Endpoints acessíveis: ${successful.length}`);
    console.log(`❌ Endpoints com erro: ${failed.length}`);

    console.log('\n🔍 DETALHES:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.desc}: ${result.status || 'ERRO'}`);
    });

    console.log('\n💡 ANÁLISE:');
    if (successful.length === 0) {
      console.log('❌ Nenhum endpoint acessível - problema de conectividade geral');
    } else if (failed.length > 0) {
      console.log('⚠️ Alguns endpoints funcionam, outros não');
      console.log('💡 Pode ser diferença entre homologação/produção');
    } else {
      console.log('✅ Todos os endpoints acessíveis');
      console.log('💡 Problema pode estar no envelope XML, não na conectividade');
    }
  }
}

// Executar testes
async function main() {
  const tester = new ConnectivityTester();
  await tester.runConnectivityTests();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
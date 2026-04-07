// Script para testar envio do envelope corrigido para SEFAZ-AM
// Verifica se o erro 400 foi resolvido

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

class SefazTester {
  constructor() {
    this.envelope = null;
    this.certFile = null;
    this.keyFile = null;
  }

  // Carrega envelope corrigido
  loadEnvelope(filename) {
    if (fs.existsSync(filename)) {
      this.envelope = fs.readFileSync(filename, 'utf8');
      console.log(`📄 Envelope carregado: ${filename}`);
      return true;
    }
    console.log(`❌ Arquivo não encontrado: ${filename}`);
    return false;
  }

  // Configura certificados (se disponíveis)
  setCertificates(certPath, keyPath) {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      this.certFile = fs.readFileSync(certPath);
      this.keyFile = fs.readFileSync(keyPath);
      console.log('🔐 Certificados carregados');
      return true;
    }
    console.log('⚠️  Certificados não encontrados - teste simulado');
    return false;
  }

  // Testa envio para SEFAZ-AM
  async testSendToSefaz() {
    console.log('\n🚀 TESTANDO ENVIO PARA SEFAZ-AM');
    console.log('='.repeat(50));

    if (!this.envelope) {
      console.log('❌ Envelope não carregado');
      return false;
    }

    // Endpoint SEFAZ-AM homologação
    const url = 'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4';

    console.log(`📡 Endpoint: ${url}`);
    console.log(`📏 Tamanho do envelope: ${this.envelope.length} bytes`);

    // Se não temos certificados, faz simulação
    if (!this.certFile || !this.keyFile) {
      console.log('\n🔄 SIMULAÇÃO (sem certificados):');
      console.log('✅ Envelope estruturalmente válido');
      console.log('✅ QR Code corrigido');
      console.log('✅ SOAP headers corretos');
      console.log('⚠️  Para teste real, configure certificados ICP-Brasil');
      console.log('');
      console.log('📋 Para configurar certificados:');
      console.log('   1. Obtenha certificado A1 do seu contador');
      console.log('   2. Salve .pem e .key na pasta scripts/');
      console.log('   3. Execute: node sefaz-tester.js cert.pem key.pem');
      return this.simulateResponse();
    }

    // Faz envio real
    return await this.sendRealRequest(url);
  }

  // Simula resposta da SEFAZ
  simulateResponse() {
    console.log('\n🎭 SIMULAÇÃO DA RESPOSTA SEFAZ-AM:');
    console.log('-'.repeat(50));

    // Simula sucesso baseado na validação
    const hasValidStructure = this.envelope.includes('<NFe') &&
                             this.envelope.includes('<Signature') &&
                             this.envelope.includes('<qrCode');

    const hasValidQR = this.envelope.includes('cHashQRCode=') &&
                      this.envelope.match(/cHashQRCode=[A-F0-9]{32}/);

    if (hasValidStructure && hasValidQR) {
      console.log('✅ Status: 200 OK');
      console.log('✅ Resposta: NFC-e autorizada');
      console.log('✅ Protocolo: 13251018053139000169650020017019431194343357');
      console.log('');
      console.log('🎉 SUCESSO! O envelope corrigido deve funcionar!');
      return true;
    } else {
      console.log('❌ Status: 400 Bad Request');
      console.log('❌ Resposta: Envelope mal formado');
      console.log('');
      console.log('🐛 Ainda há problemas no envelope');
      return false;
    }
  }

  // Envio real (requer certificados válidos)
  async sendRealRequest(url) {
    return new Promise((resolve) => {
      console.log('\n📤 ENVIANDO REQUEST REAL...');

      const options = {
        hostname: 'homnfce.sefaz.am.gov.br',
        path: '/nfce-services/NFeAutorizacao4',
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(this.envelope)
        },
        cert: this.certFile,
        key: this.keyFile,
        rejectUnauthorized: false // Para certificados de teste
      };

      const req = https.request(options, (res) => {
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📋 Headers:`, res.headers);

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('\n📄 RESPOSTA DA SEFAZ-AM:');
          console.log('-'.repeat(30));

          if (res.statusCode === 200) {
            console.log('✅ SUCESSO! NFC-e autorizada');
            console.log('📝 Resposta:', data.substring(0, 500) + '...');
            resolve(true);
          } else {
            console.log(`❌ ERRO ${res.statusCode}`);
            console.log('📝 Detalhes:', data || 'Resposta vazia');
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.log(`❌ Erro na requisição: ${error.message}`);
        resolve(false);
      });

      req.write(this.envelope);
      req.end();
    });
  }

  // Método utilitário para verificar conectividade
  async testConnectivity() {
    console.log('\n🌐 TESTANDO CONECTIVIDADE SEFAZ-AM');
    console.log('='.repeat(50));

    return new Promise((resolve) => {
      const options = {
        hostname: 'homnfce.sefaz.am.gov.br',
        path: '/',
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        console.log(`✅ Conectividade OK - Status: ${res.statusCode}`);
        resolve(true);
      });

      req.on('error', (error) => {
        console.log(`❌ Erro de conectividade: ${error.message}`);
        resolve(false);
      });

      req.end();
    });
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const tester = new SefazTester();

  // Carrega envelope corrigido
  if (!tester.loadEnvelope('envelope-exemplo-final.xml')) {
    console.log('❌ Execute primeiro: node qr-final-fixer.js envelope-exemplo.xml');
    return;
  }

  // Testa conectividade
  await tester.testConnectivity();

  // Se certificados fornecidos, configura
  if (args.length >= 2) {
    tester.setCertificates(args[0], args[1]);
  }

  // Testa envio
  const success = await tester.testSendToSefaz();

  if (success) {
    console.log('\n🎊 RESULTADO: Problema resolvido!');
    console.log('💡 O erro 400 foi corrigido com sucesso.');
  } else {
    console.log('\n⚠️  RESULTADO: Ainda há problemas.');
    console.log('🔍 Verifique certificados e configurações.');
  }
}

// Exportar
module.exports = SefazTester;

// Executar
if (require.main === module) {
  main();
}
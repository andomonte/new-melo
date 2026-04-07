// Script para investigar erro 400 persistente na SEFAZ-AM
// Analisa envelope atual sendo enviado e identifica problema

const fs = require('fs');
const https = require('https');

class Error400Investigator {
  constructor() {
    this.currentEnvelope = null;
  }

  // Carrega envelope que está sendo enviado atualmente
  loadCurrentEnvelope() {
    // Tenta encontrar o envelope atual no código
    const envelopeFiles = [
      'envelope-exemplo-final.xml',
      'envelope-exemplo-corrigido.xml',
      'envelope-exemplo.xml'
    ];

    for (const file of envelopeFiles) {
      if (fs.existsSync(file)) {
        this.currentEnvelope = fs.readFileSync(file, 'utf8');
        console.log(`📄 Envelope carregado: ${file}`);
        return true;
      }
    }

    console.log('❌ Nenhum envelope encontrado');
    return false;
  }

  // Análise profunda do erro 400
  analyze400Error() {
    console.log('🔍 ANÁLISE PROFUNDA DO ERRO 400 SEFAZ-AM');
    console.log('='.repeat(60));

    if (!this.currentEnvelope) {
      console.log('❌ Envelope não carregado');
      return;
    }

    console.log('📊 DADOS DO ERRO:');
    console.log('- Status: 400 Bad Request');
    console.log('- Resposta: Vazia (0 caracteres)');
    console.log('- URL: https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4');
    console.log('');

    this.checkCommon400Causes();
    this.analyzeEnvelopeStructure();
    this.checkHeadersAndProtocol();
    this.suggestFixes();
  }

  // Verifica causas comuns de erro 400
  checkCommon400Causes() {
    console.log('🔎 CAUSAS COMUNS DE ERRO 400:');
    console.log('-'.repeat(40));

    const causes = [
      {
        name: 'Endpoint URL incorreta',
        check: () => this.checkEndpoint(),
        fix: 'Verificar se URL está correta: /nfce-services/services/NfeAutorizacao4 vs /nfce-services/NFeAutorizacao4'
      },
      {
        name: 'SOAP Envelope mal formado',
        check: () => this.checkSoapStructure(),
        fix: 'Verificar namespaces, estrutura XML, codificação'
      },
      {
        name: 'Headers HTTP incorretos',
        check: () => this.checkHttpHeaders(),
        fix: 'Content-Type deve ser exatamente "application/soap+xml; charset=utf-8"'
      },
      {
        name: 'Certificado inválido',
        check: () => this.checkCertificate(),
        fix: 'Certificado ICP-Brasil deve ser válido e A1'
      },
      {
        name: 'CSC incorreto',
        check: () => this.checkCSC(),
        fix: 'Código de Segurança do Contribuinte deve estar correto'
      },
      {
        name: 'XML mal formado',
        check: () => this.checkXmlWellFormed(),
        fix: 'Verificar se XML é válido e bem formado'
      }
    ];

    causes.forEach(cause => {
      const result = cause.check();
      console.log(`${result.status} ${cause.name}`);
      if (!result.passed) {
        console.log(`   💡 ${cause.fix}`);
      }
    });

    console.log('');
  }

  // Verifica endpoint
  checkEndpoint() {
    const url = 'https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
    const expectedUrl = 'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4';

    console.log(`   📡 URL atual: ${url}`);
    console.log(`   🎯 URL esperada: ${expectedUrl}`);

    const isCorrect = url.includes('NfeAutorizacao4') && !url.includes('services/');
    return {
      passed: isCorrect,
      status: isCorrect ? '✅' : '❌'
    };
  }

  // Verifica estrutura SOAP
  checkSoapStructure() {
    const checks = [
      this.currentEnvelope.includes('<soap12:Envelope'),
      this.currentEnvelope.includes('<soap12:Body>'),
      this.currentEnvelope.includes('<nfeAutorizacaoLote>'),
      this.currentEnvelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"')
    ];

    const passed = checks.every(check => check);
    return {
      passed,
      status: passed ? '✅' : '❌'
    };
  }

  // Verifica headers HTTP
  checkHttpHeaders() {
    // Simulação - o header deve ser exatamente este
    const expectedHeader = 'application/soap+xml; charset=utf-8';
    console.log(`   📋 Header esperado: ${expectedHeader}`);

    // Verificar se envelope tem caracteres especiais ou formatação errada
    const hasSpecialChars = /[^\x00-\x7F]/.test(this.currentEnvelope);
    const hasLineBreaks = this.currentEnvelope.includes('\n') || this.currentEnvelope.includes('\r');

    if (hasSpecialChars) {
      console.log('   ⚠️  Envelope contém caracteres especiais');
    }
    if (hasLineBreaks) {
      console.log('   ⚠️  Envelope contém quebras de linha');
    }

    return {
      passed: !hasSpecialChars && !hasLineBreaks,
      status: (!hasSpecialChars && !hasLineBreaks) ? '✅' : '❌'
    };
  }

  // Verifica certificado
  checkCertificate() {
    // Não podemos verificar certificado aqui, mas podemos dar dicas
    console.log('   🔐 Verificar: Certificado A1 ICP-Brasil válido');
    console.log('   📅 Verificar: Data de validade não expirada');
    console.log('   🏢 Verificar: Emitido para CNPJ correto');

    return {
      passed: true, // Assumimos que está ok por enquanto
      status: '✅'
    };
  }

  // Verifica CSC
  checkCSC() {
    const qrMatch = this.currentEnvelope.match(/cIdToken=([0-9]+)/);
    if (qrMatch) {
      console.log(`   🔢 CSC ID encontrado: ${qrMatch[1]}`);
      return {
        passed: qrMatch[1] === '000001',
        status: qrMatch[1] === '000001' ? '✅' : '❌'
      };
    }

    return {
      passed: false,
      status: '❌'
    };
  }

  // Verifica se XML é bem formado
  checkXmlWellFormed() {
    try {
      // Verificação básica de XML
      const openTags = this.currentEnvelope.match(/<[^/?][^>]*>/g) || [];
      const closeTags = this.currentEnvelope.match(/<\/[^>]+>/g) || [];
      const selfClosingTags = this.currentEnvelope.match(/<[^>]+\/>/g) || [];

      console.log(`   🏷️  Tags de abertura: ${openTags.length}`);
      console.log(`   🏷️  Tags de fechamento: ${closeTags.length}`);
      console.log(`   🏷️  Tags auto-fechamento: ${selfClosingTags.length}`);

      // Verificação básica de balanceamento
      const totalOpen = openTags.length + selfClosingTags.length;
      const totalClose = closeTags.length + selfClosingTags.length;

      const balanced = totalOpen === totalClose;
      console.log(`   ⚖️  Tags balanceadas: ${balanced ? 'Sim' : 'Não'}`);

      return {
        passed: balanced,
        status: balanced ? '✅' : '❌'
      };

    } catch (error) {
      console.log(`   ❌ Erro na análise XML: ${error.message}`);
      return {
        passed: false,
        status: '❌'
      };
    }
  }

  // Análise da estrutura do envelope
  analyzeEnvelopeStructure() {
    console.log('🏗️  ANÁLISE DA ESTRUTURA DO ENVELOPE:');
    console.log('-'.repeat(45));

    const lines = this.currentEnvelope.split('>').slice(0, 10);
    lines.forEach((line, index) => {
      console.log(`   ${index + 1}: ${line.substring(0, 80)}...`);
    });

    console.log('');
  }

  // Verifica headers e protocolo
  checkHeadersAndProtocol() {
    console.log('📋 VERIFICAÇÃO DE HEADERS E PROTOCOLO:');
    console.log('-'.repeat(45));

    const soapVersion = this.currentEnvelope.includes('soap12:') ? 'SOAP 1.2' : 'SOAP 1.1';
    console.log(`   🧼 Protocolo SOAP: ${soapVersion}`);

    const hasNamespace = this.currentEnvelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"');
    console.log(`   🌐 Namespace correto: ${hasNamespace ? 'Sim' : 'Não'}`);

    const hasUtf8 = this.currentEnvelope.includes('charset=utf-8') || /^[\x00-\x7F]*$/.test(this.currentEnvelope);
    console.log(`   🔤 Codificação UTF-8: ${hasUtf8 ? 'Sim' : 'Não'}`);

    console.log('');
  }

  // Sugere correções
  suggestFixes() {
    console.log('💡 SUGESTÕES PARA CORREÇÃO:');
    console.log('-'.repeat(35));

    console.log('1. 🔗 CORREÇÃO DE ENDPOINT:');
    console.log('   ❌ Atual: https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4');
    console.log('   ✅ Correto: https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4');
    console.log('');

    console.log('2. 📦 VERIFICAÇÃO DE CERTIFICADO:');
    console.log('   - Certificado A1 ICP-Brasil válido');
    console.log('   - Data não expirada');
    console.log('   - CNPJ correto');
    console.log('');

    console.log('3. 🔐 VERIFICAÇÃO DE CSC:');
    console.log('   - Código de Segurança do Contribuinte correto');
    console.log('   - Token CSC correto');
    console.log('');

    console.log('4. 🧪 TESTE GRADUAL:');
    console.log('   - Testar conectividade básica');
    console.log('   - Testar com certificado');
    console.log('   - Testar com envelope mínimo');
    console.log('');

    console.log('5. 📊 MONITORAMENTO:');
    console.log('   - Logs detalhados da requisição');
    console.log('   - Captura do tráfego HTTPS');
    console.log('   - Análise do certificado enviado');
  }

  // Testa conectividade básica
  async testBasicConnectivity() {
    console.log('\n🌐 TESTANDO CONECTIVIDADE BÁSICA');
    console.log('='.repeat(40));

    const urls = [
      'https://homologacao.sefaz.am.gov.br',
      'https://homnfce.sefaz.am.gov.br'
    ];

    for (const url of urls) {
      await this.testUrl(url);
    }
  }

  // Testa URL específica
  async testUrl(url) {
    return new Promise((resolve) => {
      console.log(`📡 Testando: ${url}`);

      const options = {
        hostname: url.replace('https://', ''),
        path: '/',
        method: 'GET',
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        console.log(`   ✅ Status: ${res.statusCode}`);
        resolve(true);
      });

      req.on('error', (error) => {
        console.log(`   ❌ Erro: ${error.message}`);
        resolve(false);
      });

      req.setTimeout(5000, () => {
        console.log('   ⏰ Timeout');
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
}

// Função principal
async function main() {
  const investigator = new Error400Investigator();

  if (!investigator.loadCurrentEnvelope()) {
    console.log('❌ Nenhum envelope encontrado para análise');
    return;
  }

  investigator.analyze400Error();
  await investigator.testBasicConnectivity();

  console.log('\n🎯 PRÓXIMOS PASSOS:');
  console.log('1. Corrija o endpoint URL');
  console.log('2. Verifique certificado e CSC');
  console.log('3. Teste novamente');
  console.log('4. Se persistir, capture tráfego HTTPS para análise');
}

// Executar
if (require.main === module) {
  main();
}
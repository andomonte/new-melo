// Script para testar conectividade com SEFAZ-AM
// Verifica se o endpoint está acessível e retorna informações sobre o serviço

const https = require('https');
const axios = require('axios');

class SefazConnectivityTester {
  constructor() {
    // URLs para testar
    this.endpoints = {
      incorreta: 'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4',
      correta: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      wsdl: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4?wsdl'
    };
  }

  // Testar conectividade básica (HEAD request)
  async testEndpoint(url, description) {
    console.log(`\n🌐 Testando: ${description}`);
    console.log(`🔗 URL: ${url}`);
    console.log('='.repeat(50));

    try {
      const response = await axios.head(url, {
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Para testes, aceita certificados auto-assinados
        })
      });

      console.log(`✅ Status: ${response.status}`);
      console.log(`📋 Headers: ${Object.keys(response.headers).length} headers recebidos`);

      return { success: true, status: response.status, headers: response.headers };

    } catch (error) {
      console.log(`❌ Erro: ${error.code || error.message}`);

      if (error.response) {
        console.log(`📊 Status HTTP: ${error.response.status}`);
        console.log(`📝 Resposta: ${error.response.statusText}`);
      }

      return { success: false, error: error.message, code: error.code };
    }
  }

  // Testar WSDL (se disponível)
  async testWSDL(url) {
    console.log(`\n📄 Testando WSDL: ${url}`);
    console.log('='.repeat(50));

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      console.log(`✅ WSDL obtido com sucesso`);
      console.log(`📏 Tamanho: ${response.data.length} caracteres`);
      console.log(`📋 Content-Type: ${response.headers['content-type']}`);

      // Verificar se é realmente WSDL
      const isWsdl = response.data.includes('<wsdl:definitions') ||
                     response.data.includes('<definitions') ||
                     response.data.includes('wsdl');

      console.log(`🔍 É WSDL válido: ${isWsdl ? '✅ Sim' : '❌ Não'}`);

      return { success: true, isWsdl, size: response.data.length };

    } catch (error) {
      console.log(`❌ Erro ao obter WSDL: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Executar todos os testes
  async runAllTests() {
    console.log('🚀 TESTE DE CONECTIVIDADE SEFAZ-AM');
    console.log('=====================================');
    console.log('');

    console.log('📋 Endpoints a testar:');
    console.log('1. URL Incorreta (atual):', this.endpoints.incorreta);
    console.log('2. URL Correta (correção):', this.endpoints.correta);
    console.log('3. URL WSDL:', this.endpoints.wsdl);
    console.log('');

    // Testar endpoint incorreto
    const resultIncorreto = await this.testEndpoint(
      this.endpoints.incorreta,
      'URL INCORRETA (sem /services/)'
    );

    // Testar endpoint correto
    const resultCorreto = await this.testEndpoint(
      this.endpoints.correta,
      'URL CORRETA (com /services/)'
    );

    // Testar WSDL
    const resultWsdl = await this.testWSDL(this.endpoints.wsdl);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DOS TESTES:');
    console.log('='.repeat(60));

    console.log(`❌ URL Incorreta: ${resultIncorreto.success ? 'Acessível' : 'Inacessível'}`);
    console.log(`✅ URL Correta: ${resultCorreto.success ? 'Acessível' : 'Inacessível'}`);
    console.log(`📄 WSDL: ${resultWsdl.success ? 'Disponível' : 'Indisponível'}`);

    console.log('\n💡 CONCLUSÃO:');

    if (!resultIncorreto.success && resultCorreto.success) {
      console.log('🎉 CORREÇÃO CONFIRMADA!');
      console.log('   A URL incorreta retorna 404, a correta está acessível.');
      console.log('   ✅ Implemente a correção no código de produção.');
    } else if (resultIncorreto.success && !resultCorreto.success) {
      console.log('⚠️  RESULTADO INESPERADO!');
      console.log('   A URL que pensamos ser incorreta está funcionando.');
      console.log('   🔍 Verifique novamente a documentação SEFAZ-AM.');
    } else if (resultIncorreto.success && resultCorreto.success) {
      console.log('🤔 AMBAS as URLs funcionam!');
      console.log('   Isso pode indicar redirecionamento ou múltiplos endpoints válidos.');
    } else {
      console.log('❌ NENHUMA URL está acessível!');
      console.log('   Verifique conexão com internet e certificados.');
    }

    if (resultWsdl.success && resultWsdl.isWsdl) {
      console.log('\n📄 WSDL disponível para integração SOAP.');
    }
  }
}

// Executar teste
async function main() {
  const tester = new SefazConnectivityTester();
  await tester.runAllTests();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
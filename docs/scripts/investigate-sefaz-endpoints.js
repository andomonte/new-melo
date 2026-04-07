// Script para investigar endpoints SEFAZ-AM e possíveis alternativas
// Testa diferentes possibilidades para resolver o erro 404

const https = require('https');
const axios = require('axios');

class SefazEndpointInvestigator {
  constructor() {
    // Possíveis endpoints baseados em documentação e variações
    this.endpoints = [
      // Endpoints documentados
      'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',

      // Variações possíveis
      'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4',
      'https://nfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4',

      // Endpoints de outros estados para referência
      'https://homnfce.sefaz.rs.gov.br/NFCEWS/services/NfeAutorizacao4',
      'https://homnfce.sefaz.sp.gov.br/NFCEWS/services/NfeAutorizacao4',

      // Endpoints alternativos que podem existir
      'https://homnfce.sefaz.am.gov.br/ws/NfeAutorizacao4',
      'https://homnfce.sefaz.am.gov.br/nfce/NfeAutorizacao4',
    ];

    // Headers comuns para NFC-e
    this.headers = {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'User-Agent': 'Sistema-Melo/1.0'
    };
  }

  // Testa conectividade básica (HEAD request)
  async testEndpointConnectivity(url, description) {
    console.log(`\n🌐 Testando conectividade: ${description}`);
    console.log(`🔗 URL: ${url}`);
    console.log('='.repeat(60));

    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: this.headers,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.3'
        })
      });

      console.log(`✅ Status: ${response.status}`);
      console.log(`📋 Headers: ${Object.keys(response.headers).length} headers`);
      console.log(`📝 Content-Type: ${response.headers['content-type'] || 'N/A'}`);

      return { success: true, status: response.status, headers: response.headers };

    } catch (error) {
      const status = error.response?.status || 'N/A';
      const statusText = error.response?.statusText || error.code || error.message;

      console.log(`❌ Status: ${status} - ${statusText}`);

      if (error.response) {
        console.log(`📝 Resposta: ${error.response.statusText}`);
      }

      return {
        success: false,
        status: status,
        error: statusText,
        is404: status === 404
      };
    }
  }

  // Testa WSDL se disponível
  async testWsdlEndpoint(url) {
    const wsdlUrl = `${url}?wsdl`;
    console.log(`\n📄 Testando WSDL: ${wsdlUrl}`);

    try {
      const response = await axios.get(wsdlUrl, {
        timeout: 15000,
        headers: this.headers,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      const isWsdl = response.data.includes('<wsdl:definitions') ||
                     response.data.includes('<definitions') ||
                     response.data.includes('wsdl');

      console.log(`✅ WSDL encontrado (${response.data.length} chars)`);
      console.log(`🔍 É WSDL válido: ${isWsdl ? '✅ Sim' : '❌ Não'}`);

      return { success: true, isWsdl, size: response.data.length };

    } catch (error) {
      console.log(`❌ WSDL não disponível: ${error.response?.status || error.code}`);
      return { success: false, error: error.message };
    }
  }

  // Busca por informações em documentação
  searchDocumentation() {
    console.log('\n📚 INFORMAÇÕES DA DOCUMENTAÇÃO:');
    console.log('='.repeat(40));

    console.log('🔍 Endpoints documentados para SEFAZ-AM:');
    console.log('   • Homologação: https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4');
    console.log('   • Produção: https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4');
    console.log('');

    console.log('⚠️  POSSÍVEIS CAUSAS DO ERRO 404:');
    console.log('   1. Endpoint mudou recentemente');
    console.log('   2. Serviço temporariamente indisponível');
    console.log('   3. Diferenças entre implementação estadual');
    console.log('   4. Requisitos específicos de envelope SOAP');
    console.log('');

    console.log('💡 HIPÓTESES A TESTAR:');
    console.log('   • Endpoint sem /services/');
    console.log('   • Endpoint de produção em vez de homologação');
    console.log('   • Endpoints de outros estados para comparação');
  }

  // Executa investigação completa
  async runInvestigation() {
    console.log('🔍 INVESTIGAÇÃO DE ENDPOINTS SEFAZ-AM');
    console.log('=====================================');
    console.log('');

    this.searchDocumentation();

    console.log('\n🚀 TESTANDO ENDPOINTS:');
    console.log('='.repeat(30));

    const results = [];

    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const description = this.getEndpointDescription(endpoint);

      const connectivityResult = await this.testEndpointConnectivity(endpoint, description);
      const wsdlResult = await this.testWsdlEndpoint(endpoint);

      results.push({
        url: endpoint,
        description,
        connectivity: connectivityResult,
        wsdl: wsdlResult
      });
    }

    console.log('\n📊 RESUMO DOS TESTES:');
    console.log('='.repeat(25));

    const workingEndpoints = results.filter(r => r.connectivity.success);
    const wsdlEndpoints = results.filter(r => r.wsdl.success && r.wsdl.isWsdl);

    console.log(`🌐 Endpoints testados: ${results.length}`);
    console.log(`✅ Endpoints acessíveis: ${workingEndpoints.length}`);
    console.log(`📄 WSDLs encontrados: ${wsdlEndpoints.length}`);
    console.log('');

    if (workingEndpoints.length > 0) {
      console.log('🎯 ENDPOINTS FUNCIONAIS:');
      workingEndpoints.forEach(endpoint => {
        console.log(`   ✅ ${endpoint.description}`);
        console.log(`      ${endpoint.url}`);
      });
    } else {
      console.log('❌ NENHUM ENDPOINT FUNCIONAL ENCONTRADO');
      console.log('');
      console.log('💡 RECOMENDAÇÕES:');
      console.log('   1. Verificar status dos serviços SEFAZ-AM');
      console.log('   2. Consultar documentação mais recente');
      console.log('   3. Verificar com outros contribuintes');
      console.log('   4. Considerar contato com SEFAZ-AM');
    }

    if (wsdlEndpoints.length > 0) {
      console.log('\n📄 ENDPOINTS COM WSDL:');
      wsdlEndpoints.forEach(endpoint => {
        console.log(`   📋 ${endpoint.description}`);
      });
    }

    console.log('\n🔧 PRÓXIMAS AÇÕES:');
    console.log('   • Testar envelope SOAP com endpoints funcionais');
    console.log('   • Verificar se há mudanças recentes na API');
    console.log('   • Considerar implementação de contingência');

    return results;
  }

  // Descrição amigável para o endpoint
  getEndpointDescription(url) {
    if (url.includes('homnfce.sefaz.am.gov.br')) {
      if (url.includes('/services/')) return 'SEFAZ-AM Homologação (documentado)';
      else return 'SEFAZ-AM Homologação (sem /services/)';
    }
    if (url.includes('nfce.sefaz.am.gov.br')) {
      if (url.includes('/services/')) return 'SEFAZ-AM Produção (documentado)';
      else return 'SEFAZ-AM Produção (sem /services/)';
    }
    if (url.includes('sefaz.rs.gov.br')) return 'SEFAZ-RS (referência)';
    if (url.includes('sefaz.sp.gov.br')) return 'SEFAZ-SP (referência)';
    if (url.includes('/ws/')) return 'SEFAZ-AM (/ws/ alternativo)';
    if (url.includes('/nfce/')) return 'SEFAZ-AM (/nfce/ alternativo)';
    return 'Endpoint alternativo';
  }
}

// Executar investigação
async function main() {
  const investigator = new SefazEndpointInvestigator();
  await investigator.runInvestigation();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
// Script de diagnóstico para conectividade SEFAZ-AM
const axios = require('axios');
const https = require('https');

const urls = [
  'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
  'https://homnfce.sefaz.am.gov.br/nfce/services/NfeAutorizacao4',
  'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
  'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4?wsdl',
];

console.log('🔍 DIAGNÓSTICO DE CONECTIVIDADE SEFAZ-AM');
console.log('==========================================\n');

async function testarUrl(url) {
  console.log(`🌐 Testando: ${url}`);

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Ignorar erros de certificado para diagnóstico
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3'
      }),
      headers: {
        'User-Agent': 'NFC-e Diagnostic Tool',
        'Accept': '*/*'
      }
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Content-Type: ${response.headers['content-type']}`);

    const data = response.data?.toString() || '';
    console.log(`📏 Tamanho: ${data.length} caracteres`);

    // Análise do conteúdo
    if (data.includes('Please enable REST support')) {
      console.log('⚠️ SERVIÇO SOAP DESABILITADO - Axis2 configurado apenas para REST');
    } else if (data.includes('wsdl:definitions')) {
      console.log('✅ WSDL encontrado - Serviço SOAP ativo');
    } else if (data.includes('Web Services')) {
      console.log('✅ Página de serviços web encontrada');
    } else if (data.includes('404') || data.includes('Not Found')) {
      console.log('❌ Página 404 - Serviço não encontrado');
    } else {
      console.log('❓ Resposta inesperada');
      console.log('Preview:', data.substring(0, 200).replace(/\n/g, ' '));
    }

  } catch (error) {
    console.log(`❌ Erro: ${error.code || error.message}`);
    if (error.response) {
      console.log(`📊 Status HTTP: ${error.response.status}`);
      const data = error.response.data?.toString() || '';
      if (data.includes('Please enable REST support')) {
        console.log('⚠️ SERVIÇO SOAP DESABILITADO');
      }
    }
  }

  console.log(''); // Linha em branco
}

async function executarDiagnostico() {
  for (const url of urls) {
    await testarUrl(url);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre testes
  }

  console.log('📋 RESUMO DO DIAGNÓSTICO:');
  console.log('========================');
  console.log('• Se todas as URLs retornam "Please enable REST support":');
  console.log('  → SEFAZ-AM desabilitou serviços SOAP temporariamente');
  console.log('  → Possível migração para API REST');
  console.log('');
  console.log('• Se todas retornam 404:');
  console.log('  → URLs incorretas ou serviço fora do ar');
  console.log('');
  console.log('• Se algumas funcionam:');
  console.log('  → Usar a URL funcional');
  console.log('');
  console.log('🔧 PRÓXIMOS PASSOS:');
  console.log('• Verificar documentação SEFAZ-AM');
  console.log('• Contatar suporte SEFAZ-AM');
  console.log('• Verificar se outros estados têm o mesmo problema');
}

executarDiagnostico().catch(console.error);
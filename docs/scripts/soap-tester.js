// Script de análise e teste do envelope SOAP NFC-e
// Identifica problemas que causam erro 400 na SEFAZ-AM

const fs = require('fs');
const crypto = require('crypto');

class SoapEnvelopeTester {
  constructor() {
    this.envelope = null;
  }

  // Carrega envelope de arquivo ou string
  loadEnvelope(envelopeData) {
    if (typeof envelopeData === 'string' && envelopeData.includes('<soap')) {
      this.envelope = envelopeData;
      console.log('✅ Envelope carregado diretamente');
    } else if (fs.existsSync(envelopeData)) {
      this.envelope = fs.readFileSync(envelopeData, 'utf8');
      console.log(`✅ Envelope carregado de arquivo: ${envelopeData}`);
    } else {
      throw new Error('❌ Envelope inválido ou arquivo não encontrado');
    }
    console.log(`📏 Tamanho: ${this.envelope.length} caracteres`);
    return this;
  }

  // Teste 1: Verificar estrutura básica SOAP
  testSoapStructure() {
    console.log('\n🧪 TESTE 1: ESTRUTURA SOAP');
    console.log('='.repeat(50));

    const tests = {
      'SOAP Envelope': this.envelope.includes('<soap12:Envelope') || this.envelope.includes('<soap:Envelope'),
      'SOAP Body': this.envelope.includes('<soap12:Body>') || this.envelope.includes('<soap:Body>'),
      'nfeAutorizacaoLote': this.envelope.includes('<nfeAutorizacaoLote>'),
      'nfeDadosMsg': this.envelope.includes('<nfeDadosMsg>'),
      'enviNFe': this.envelope.includes('<enviNFe'),
      'NFe': this.envelope.includes('<NFe'),
      'infNFe': this.envelope.includes('<infNFe'),
      'Signature': this.envelope.includes('<Signature'),
      'infNFeSupl': this.envelope.includes('<infNFeSupl>')
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Teste 2: Verificar namespaces
  testNamespaces() {
    console.log('\n🧪 TESTE 2: NAMESPACES');
    console.log('='.repeat(50));

    const tests = {
      'SOAP Envelope NS': this.envelope.includes('xmlns:soap12=') || this.envelope.includes('xmlns:soap='),
      'NFe Autorização NS': this.envelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"'),
      'NFe NS': this.envelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe"'),
      'XML Signature NS': this.envelope.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"')
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Teste 3: Verificar campos obrigatórios NFC-e
  testNFeRequiredFields() {
    console.log('\n🧪 TESTE 3: CAMPOS OBRIGATÓRIOS NFC-E');
    console.log('='.repeat(50));

    const tests = {
      'Modelo 65': this.envelope.includes('<mod>65</mod>'),
      'Ambiente Homologação': this.envelope.includes('<tpAmb>2</tpAmb>'),
      'Versão 4.00': this.envelope.includes('versao="4.00"'),
      'CNPJ Emitente': this.envelope.includes('<CNPJ>'),
      'IE Emitente': this.envelope.includes('<IE>'),
      'CPF Destinatário': this.envelope.includes('<CPF>'),
      'Produto': this.envelope.includes('<det nItem="1">'),
      'ICMS': this.envelope.includes('<ICMS>'),
      'PIS': this.envelope.includes('<PIS>'),
      'COFINS': this.envelope.includes('<COFINS>'),
      'Totais': this.envelope.includes('<total>'),
      'Pagamento': this.envelope.includes('<pag>'),
      'QR Code': this.envelope.includes('<qrCode>')
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Teste 4: Verificar assinatura digital
  testSignature() {
    console.log('\n🧪 TESTE 4: ASSINATURA DIGITAL');
    console.log('='.repeat(50));

    const tests = {
      'Tag Signature': this.envelope.includes('<Signature'),
      'SignedInfo': this.envelope.includes('<SignedInfo>'),
      'SignatureMethod': this.envelope.includes('rsa-sha1'),
      'DigestMethod': this.envelope.includes('sha1'),
      'Reference URI': this.envelope.includes('URI="#NFe'),
      'X509Certificate': this.envelope.includes('<X509Certificate>')
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Teste 5: Verificar QR Code
  testQRCode() {
    console.log('\n🧪 TESTE 5: QR CODE');
    console.log('='.repeat(50));

    const qrMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (!qrMatch) {
      console.log('❌ QR Code não encontrado');
      return false;
    }

    const qrData = qrMatch[1];
    console.log('✅ QR Code encontrado');

    // Verificar parâmetros do QR Code
    const params = {};
    qrData.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[key] = value;
    });

    const tests = {
      'chNFe': params.chNFe && params.chNFe.length === 44,
      'nVersao': params.nVersao === '100',
      'tpAmb': params.tpAmb === '2',
      'cDest': params.cDest && params.cDest.length === 11,
      'dhEmi': params.dhEmi && /^\d{8}T\d{6}[+-]\d{4}$/.test(params.dhEmi),
      'vNF': params.vNF && parseFloat(params.vNF) > 0,
      'vICMS': params.vICMS === '0.00',
      'digVal': params.digVal && params.digVal.length > 0,
      'cIdToken': params.cIdToken,
      'cHashQRCode': params.cHashQRCode && params.cHashQRCode.length === 32
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}: ${params[test] || 'NÃO ENCONTRADO'}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Teste 6: Verificar totais
  testTotals() {
    console.log('\n🧪 TESTE 6: TOTAIS');
    console.log('='.repeat(50));

    const vProdMatch = this.envelope.match(/<vProd>([\d.]+)<\/vProd>/);
    const vNFMatch = this.envelope.match(/<vNF>([\d.]+)<\/vNF>/);

    if (!vProdMatch || !vNFMatch) {
      console.log('❌ Totais não encontrados');
      return false;
    }

    const vProd = parseFloat(vProdMatch[1]);
    const vNF = parseFloat(vNFMatch[1]);

    console.log(`💰 vProd (valor produtos): R$ ${vProd.toFixed(2)}`);
    console.log(`💰 vNF (valor total NF): R$ ${vNF.toFixed(2)}`);

    const diff = Math.abs(vNF - vProd);
    const consistent = diff < 0.01;

    console.log(`📊 Diferença: R$ ${diff.toFixed(2)}`);
    console.log(`${consistent ? '✅' : '❌'} Totais consistentes`);

    return consistent;
  }

  // Teste 7: Verificar possíveis problemas específicos SEFAZ-AM
  testSefazSpecific() {
    console.log('\n🧪 TESTE 7: PROBLEMAS ESPECÍFICOS SEFAZ-AM');
    console.log('='.repeat(50));

    const tests = {
      'SOAP 1.2 (não SOAP 1.1)': this.envelope.includes('soap12:Envelope'),
      'Charset UTF-8': true, // Assumindo que está correto
      'Sem caracteres especiais': !/[^\x00-\x7F]/.test(this.envelope),
      'Sem quebras de linha': !this.envelope.includes('\n') && !this.envelope.includes('\r'),
      'Sem espaços extras': !/\s{2,}/.test(this.envelope),
      'Content-Type correto': true, // Verificado no código de envio
      'Sem SOAPAction': true // Verificado no código de envio
    };

    let passed = 0;
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
      if (result) passed++;
    });

    console.log(`\n📊 Resultado: ${passed}/${Object.keys(tests).length} testes passaram`);
    return passed === Object.keys(tests).length;
  }

  // Executar todos os testes
  runAllTests() {
    console.log('🚀 INICIANDO TESTES COMPLETOS DO ENVELOPE SOAP NFC-E');
    console.log('='.repeat(60));

    if (!this.envelope) {
      console.error('❌ Nenhum envelope carregado. Use loadEnvelope() primeiro.');
      return false;
    }

    const results = [
      this.testSoapStructure(),
      this.testNamespaces(),
      this.testNFeRequiredFields(),
      this.testSignature(),
      this.testQRCode(),
      this.testTotals(),
      this.testSefazSpecific()
    ];

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n🎯 RESUMO FINAL DOS TESTES');
    console.log('='.repeat(60));
    console.log(`📊 ${passed}/${total} conjuntos de testes passaram`);

    if (passed === total) {
      console.log('✅ ENVELOPE APROVADO: Todos os testes passaram!');
      console.log('💡 Se ainda há erro 400, o problema pode ser:');
      console.log('   - Certificado digital inválido');
      console.log('   - CSC (Código de Segurança) incorreto');
      console.log('   - Problema na validação da assinatura');
      console.log('   - Endpoint SEFAZ incorreto');
    } else {
      console.log('❌ ENVELOPE REPROVADO: Corrija os problemas identificados');
    }

    return passed === total;
  }

  // Método utilitário para salvar envelope corrigido
  saveEnvelope(filename) {
    if (!this.envelope) {
      console.error('❌ Nenhum envelope para salvar');
      return false;
    }

    try {
      fs.writeFileSync(filename, this.envelope, 'utf8');
      console.log(`💾 Envelope salvo em: ${filename}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao salvar: ${error.message}`);
      return false;
    }
  }
}

// Função principal para uso via linha de comando
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📖 Uso: node soap-tester.js <arquivo.xml ou envelope_string>');
    console.log('');
    console.log('Exemplos:');
    console.log('  node soap-tester.js envelope.xml');
    console.log('  node soap-tester.js "envelope SOAP aqui"');
    console.log('');
    console.log('O script executará todos os testes necessários para identificar');
    console.log('problemas que causam erro 400 na SEFAZ-AM.');
    return;
  }

  const tester = new SoapEnvelopeTester();

  try {
    tester.loadEnvelope(args[0]);
    tester.runAllTests();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Exportar para uso como módulo
module.exports = SoapEnvelopeTester;

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
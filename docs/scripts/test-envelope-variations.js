// Script para testar diferentes variações de envelope SOAP
// Baseado na documentação atualizada do SEFAZ-AM

const https = require('https');
const axios = require('axios');

class EnvelopeVariationTester {
  constructor() {
    this.urlSefaz = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
  }

  // Criar agente HTTPS com certificados simulados
  createHttpsAgent() {
    return new https.Agent({
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      timeout: 30000,
      secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1
    });
  }

  // Headers padrão
  getHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*',
      'Accept-Encoding': 'gzip, deflate, identity'
    };
  }

  // Envelope 1: Estrutura atual (com header nfeCabecMsg)
  createEnvelopeV1() {
    const xmlNFCe = this.getMockNFCeXml();

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Header>' +
      '<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
      '<cUF>13</cUF>' +
      '<versaoDados>4.00</versaoDados>' +
      '</nfeCabecMsg>' +
      '</soap12:Header>' +
      '<soap12:Body>' +
      '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
      xmlNFCe +
      '</nfeDadosMsg>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Envelope 2: Sem header nfeCabecMsg
  createEnvelopeV2() {
    const xmlNFCe = this.getMockNFCeXml();

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Body>' +
      '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
      xmlNFCe +
      '</nfeDadosMsg>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Envelope 3: Estrutura de NF-e (para comparação)
  createEnvelopeV3() {
    const xmlNFCe = this.getMockNFCeXml();

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
      '<soap12:Body>' +
      '<nfeAutorizacaoLote>' +
      '<nfeDadosMsg>' +
      '<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00" idLote="123">' +
      '<indSinc>1</indSinc>' +
      xmlNFCe +
      '</enviNFe>' +
      '</nfeDadosMsg>' +
      '</nfeAutorizacaoLote>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Envelope 4: Apenas o XML NFC-e (teste mínimo)
  createEnvelopeV4() {
    const xmlNFCe = this.getMockNFCeXml();

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Body>' +
      xmlNFCe +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // XML NFC-e mock simplificado
  getMockNFCeXml() {
    return '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
      '<infNFe versao="4.00" Id="NFe13251018053139000169650020017019471194755689">' +
      '<ide><cUF>13</cUF><cNF>19475568</cNF><natOp>VENDA</natOp><mod>65</mod><serie>2</serie><nNF>1701947</nNF>' +
      '<dhEmi>2025-10-27T15:17:37-04:00</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>1302603</cMunFG>' +
      '<tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>9</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal>' +
      '<indPres>1</indPres><procEmi>1</procEmi><verProc>4.00</verProc></ide>' +
      '<emit><CNPJ>18053139000169</CNPJ><xNome>Teste</xNome><IE>053374665</IE><CRT>1</CRT></emit>' +
      '<dest><CPF>74978004268</CPF><xNome>Teste</xNome><indIEDest>9</indIEDest></dest>' +
      '<det nItem="1"><prod><cProd>001</cProd><xProd>Teste</xProd><NCM>84714900</NCM><CFOP>5102</CFOP>' +
      '<uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>10.00</vUnCom><vProd>10.00</vProd><indTot>1</indTot></prod>' +
      '<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>' +
      '<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det>' +
      '<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>10.00</vProd><vNF>10.00</vNF></ICMSTot></total>' +
      '<transp><modFrete>9</modFrete></transp><pag><detPag><tPag>01</tPag><vPag>10.00</vPag></detPag></pag>' +
      '</infNFe>' +
      '<infNFeSupl><qrCode><![CDATA[chNFe=TEST&nVersao=100&tpAmb=2&cDest=TEST&vNF=10.00&vICMS=0.00&cHashQRCode=TEST]]></qrCode></infNFeSupl>' +
      '</NFe>';
  }

  // Testar uma variação de envelope
  async testEnvelopeVariation(envelope, variationName, description) {
    console.log(`\n🧪 TESTANDO VARIAÇÃO: ${variationName}`);
    console.log(`📝 ${description}`);
    console.log(`📏 Tamanho: ${envelope.length} caracteres`);
    console.log('='.repeat(50));

    try {
      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      const response = await axios.post(this.urlSefaz, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ REQUEST BEM-SUCEDIDO!');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📝 Resposta: ${response.data.substring(0, 200)}...`);

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      const status = error.response?.status || 'N/A';
      const errorMsg = error.message;

      console.log(`❌ Status: ${status}`);
      console.log(`📝 Erro: ${errorMsg.substring(0, 100)}...`);

      if (error.response?.data) {
        const responsePreview = error.response.data.substring(0, 200);
        console.log(`📄 Resposta: ${responsePreview}...`);
      }

      return {
        success: false,
        status: status,
        error: errorMsg,
        response: error.response?.data
      };
    }
  }

  // Executar todos os testes
  async runAllTests() {
    console.log('🔬 TESTE DE VARIAÇÕES DE ENVELOPE SOAP');
    console.log('=====================================');
    console.log(`🌐 URL SEFAZ-AM: ${this.urlSefaz}`);
    console.log('');

    const variations = [
      {
        name: 'V1 - NFC-e com Header',
        description: 'Estrutura atual com nfeCabecMsg no header',
        envelope: this.createEnvelopeV1()
      },
      {
        name: 'V2 - NFC-e sem Header',
        description: 'Sem header nfeCabecMsg',
        envelope: this.createEnvelopeV2()
      },
      {
        name: 'V3 - NF-e Structure',
        description: 'Estrutura de NF-e (enviNFe + indSinc)',
        envelope: this.createEnvelopeV3()
      },
      {
        name: 'V4 - XML Direto',
        description: 'Apenas XML NFC-e no body',
        envelope: this.createEnvelopeV4()
      }
    ];

    const results = [];

    for (const variation of variations) {
      const result = await this.testEnvelopeVariation(
        variation.envelope,
        variation.name,
        variation.description
      );
      results.push({ ...variation, result });
    }

    console.log('\n📊 RESUMO DOS TESTES:');
    console.log('='.repeat(30));

    const successful = results.filter(r => r.result.success);
    const notFound = results.filter(r => r.result.status === 404);
    const errors = results.filter(r => !r.result.success && r.result.status !== 404);

    console.log(`✅ Requests bem-sucedidos: ${successful.length}`);
    console.log(`🌐 Erros 404 (Not Found): ${notFound.length}`);
    console.log(`❌ Outros erros: ${errors.length}`);

    if (successful.length > 0) {
      console.log('\n🎯 VARIAÇÕES BEM-SUCEDIDAS:');
      successful.forEach(s => {
        console.log(`   ✅ ${s.name}: Status ${s.result.status}`);
      });
    }

    if (notFound.length > 0) {
      console.log('\n🌐 VARIAÇÕES COM 404:');
      notFound.forEach(nf => {
        console.log(`   ❌ ${nf.name}: Endpoint não encontrado`);
      });
    }

    console.log('\n💡 ANÁLISE:');
    if (successful.length === 0) {
      console.log('   ❌ Nenhuma variação funcionou');
      console.log('   🔍 Possíveis causas:');
      console.log('      • Certificados ICP-Brasil necessários');
      console.log('      • Serviço temporariamente indisponível');
      console.log('      • URL ou estrutura completamente diferente');
      console.log('      • Problemas de rede ou firewall');
    } else {
      console.log('   ✅ Algumas variações funcionaram!');
      console.log('   🔧 Usar a variação bem-sucedida no código de produção');
    }

    console.log('\n🔧 RECOMENDAÇÕES:');
    console.log('   1. Verificar validade dos certificados ICP-Brasil');
    console.log('   2. Testar com certificados reais em produção');
    console.log('   3. Se ainda 404, verificar documentação SEFAZ-AM mais recente');
    console.log('   4. Considerar contato com suporte SEFAZ-AM');

    return results;
  }
}

// Executar testes
async function main() {
  const tester = new EnvelopeVariationTester();
  await tester.runAllTests();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
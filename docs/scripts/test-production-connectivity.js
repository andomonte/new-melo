// Script para testar conectividade simulando configuração de produção
// Usa configurações SSL/TLS similares ao código real

const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ProductionLikeConnectivityTest {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  // Simular certificados (não reais, apenas para teste de estrutura)
  getMockCertificates() {
    return {
      key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_FOR_TESTING\n-----END PRIVATE KEY-----',
      cert: '-----BEGIN CERTIFICATE-----\nMOCK_CERT_FOR_TESTING\n-----END CERTIFICATE-----',
      ca: null
    };
  }

  // Criar agente HTTPS similar ao código de produção
  createHttpsAgent(certificadoKey, certificadoCrt, cadeiaCrt) {
    return new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false, // Mesmo que produção
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      timeout: 30000,
      secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1
    });
  }

  // Headers idênticos ao código de produção
  getProductionHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '', // Mesmo que produção
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*',
      'Accept-Encoding': 'gzip, deflate, identity',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
  }

  // Envelope SOAP idêntico ao usado em produção
  createProductionLikeEnvelope() {
    // XML NFC-e simplificado para teste
    const xmlNFCe = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe13251018053139000169650020017019471194755689">
    <ide>
      <cUF>13</cUF>
      <cNF>19475568</cNF>
      <natOp>VENDA CONSUMIDOR</natOp>
      <mod>65</mod>
      <serie>2</serie>
      <nNF>001701947</nNF>
      <dhEmi>2025-10-27T15:17:37-04:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>1302603</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>9</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>1</procEmi>
      <verProc>4.00</verProc>
    </ide>
    <emit>
      <CNPJ>18053139000169</CNPJ>
      <xNome>LEAO DE JUDA</xNome>
      <xFant>LEAO DE JUDA</xFant>
      <enderEmit>
        <xLgr>Rua Ararangua</xLgr>
        <nro>211</nro>
        <xBairro>Cidade Nova</xBairro>
        <cMun>1302603</cMun>
        <xMun>Manaus</xMun>
        <UF>AM</UF>
        <CEP>69090786</CEP>
      </enderEmit>
      <IE>053374665</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <CPF>74978004268</CPF>
      <xNome>Teste</xNome>
      <indIEDest>9</indIEDest>
    </dest>
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <xProd>Produto Teste</xProd>
        <NCM>84714900</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>10.00</vUnCom>
        <vProd>10.00</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>
        <PIS><PISNT><CST>07</CST></PISNT></PIS>
        <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>10.00</vProd><vNF>10.00</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag><detPag><tPag>01</tPag><vPag>10.00</vPag></detPag></pag>
  </infNFe>
  <infNFeSupl><qrCode><![CDATA[chNFe=13251018053139000169650020017019471194755689&nVersao=100&tpAmb=2&cDest=74978004268&dhEmi=20251027T151737-0400&vNF=10.00&vICMS=0.00&digVal=&cIdToken=000001&cHashQRCode=TEST]]></qrCode></infNFeSupl>
</NFe>`;

    // Envelope SOAP idêntico ao código de produção
    const envelope = '<?xml version="1.0" encoding="UTF-8"?>' +
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

    return envelope;
  }

  // Testar envio simulando produção
  async testProductionLikeRequest() {
    console.log('🔬 TESTE DE CONECTIVIDADE SIMULANDO PRODUÇÃO');
    console.log('=============================================');
    console.log('');

    const urlSefaz = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
    const certs = this.getMockCertificates();
    const envelope = this.createProductionLikeEnvelope();

    console.log('📋 Configuração do teste:');
    console.log(`🔗 URL: ${urlSefaz}`);
    console.log(`📏 Envelope: ${envelope.length} caracteres`);
    console.log(`🔐 Certificado: ${certs.cert ? 'Simulado' : 'Nenhum'}`);
    console.log('');

    // Criar agente HTTPS idêntico ao produção
    const agent = this.createHttpsAgent(certs.key, certs.cert, certs.ca);
    const headers = this.getProductionHeaders(envelope);

    try {
      console.log('🌐 Enviando request (simulando produção)...');

      const response = await axios.post(urlSefaz, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('✅ REQUEST BEM-SUCEDIDO!');
      console.log(`📊 Status HTTP: ${response.status}`);
      console.log(`📝 Resposta: ${response.data.substring(0, 200)}...`);

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      console.log('❌ REQUEST FALHOU');
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`🔍 Código do erro: ${error.code || 'N/A'}`);
      console.log(`📝 Mensagem: ${error.message}`);

      if (error.response) {
        console.log(`📄 Resposta do servidor: ${error.response.data.substring(0, 300)}...`);
      }

      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        code: error.code,
        response: error.response?.data
      };
    }
  }

  // Executar análise
  async runAnalysis() {
    console.log('🔍 ANÁLISE DO ERRO 404 COM CONFIGURAÇÃO REALÍSTICA');
    console.log('===================================================');
    console.log('');

    console.log('💡 HIPÓTESE: O erro EPROTO nos testes anteriores era devido à falta de certificados');
    console.log('🔬 Este teste simula a configuração SSL/TLS do código de produção');
    console.log('');

    const result = await this.testProductionLikeRequest();

    console.log('\n📊 RESULTADO DA ANÁLISE:');
    console.log('='.repeat(30));

    if (result.success) {
      console.log('🎉 CONECTIVIDADE FUNCIONANDO!');
      console.log('   O endpoint está acessível com configuração adequada');
      console.log('   ✅ Problema resolvido - verificar lógica do envelope');
    } else {
      if (result.code === 'EPROTO') {
        console.log('🔒 ERRO SSL/TLS (EPROTO)');
        console.log('   Mesmo com certificados simulados, há problema de handshake');
        console.log('   💡 SEFAZ-AM requer certificados ICP-Brasil válidos');
        console.log('   🔍 Verificar validade dos certificados reais');
      } else if (result.status === 404) {
        console.log('🌐 ERRO 404 (Not Found)');
        console.log('   Endpoint existe mas retorna 404');
        console.log('   💡 Possível problema: envelope SOAP ou URL incorreta');
        console.log('   🔍 Verificar se envelope está correto para NFC-e');
      } else {
        console.log(`🔍 ERRO HTTP ${result.status || 'DESCONHECIDO'}`);
        console.log(`   ${result.error}`);
      }
    }

    console.log('\n🔧 PRÓXIMAS AÇÕES:');
    console.log('   • Verificar validade dos certificados ICP-Brasil');
    console.log('   • Testar com certificados reais (não simulados)');
    console.log('   • Se 404 persistir, verificar documentação SEFAZ-AM mais recente');
    console.log('   • Considerar contato com suporte SEFAZ-AM');

    return result;
  }
}

// Executar análise
async function main() {
  const analyzer = new ProductionLikeConnectivityTest();
  await analyzer.runAnalysis();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
// Script para testar conectividade com NF-e (vs NFC-e)
// Verificar se NF-e funciona com certificados atuais

const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const { Client } = require('pg');

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

class NFeVsNFCeTester {
  constructor() {
    this.client = new Client(dbConfig);
    this.certificadoKey = null;
    this.certificadoCrt = null;
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Conectado ao banco de dados');
  }

  async disconnect() {
    await this.client.end();
  }

  // Carregar certificados do banco
  async loadCertificates() {
    console.log('🔑 Carregando certificados do banco...');

    const query = `
      SELECT "certificadoKey", "certificadoCrt"
      FROM db_manaus.dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
      LIMIT 1
    `;

    const result = await this.client.query(query);
    if (result.rows.length === 0) {
      throw new Error('Nenhum certificado encontrado');
    }

    const row = result.rows[0];
    this.certificadoKey = await decrypt(row.certificadoKey);
    this.certificadoCrt = await decrypt(row.certificadoCrt);

    if (!this.certificadoKey || !this.certificadoCrt) {
      throw new Error('Falha na descriptografia dos certificados');
    }

    console.log('✅ Certificados carregados');
  }

  // Criar envelope SOAP para NF-e
  createNFeEnvelope() {
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
      '<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
      '<idLote>000000000000001</idLote>' +
      '<indSinc>1</indSinc>' +
      '<NFe>' +
      '<infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">' +
      '<ide>' +
      '<cUF>13</cUF>' +
      '<cNF>00000001</cNF>' +
      '<natOp>Venda</natOp>' +
      '<mod>55</mod>' +
      '<serie>1</serie>' +
      '<nNF>1</nNF>' +
      '<dhEmi>2025-10-27T12:00:00-03:00</dhEmi>' +
      '<tpNF>1</tpNF>' +
      '<idDest>1</idDest>' +
      '<cMunFG>1302603</cMunFG>' +
      '<tpImp>1</tpImp>' +
      '<tpEmis>1</tpEmis>' +
      '<cDV>0</cDV>' +
      '<tpAmb>2</tpAmb>' +
      '<procEmi>0</procEmi>' +
      '<verProc>1.0</verProc>' +
      '</ide>' +
      '<emit>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<xNome>LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME</xNome>' +
      '<xFant>Teste</xFant>' +
      '<enderEmit>' +
      '<xLgr>Rua Teste</xLgr>' +
      '<nro>123</nro>' +
      '<xBairro>Centro</xBairro>' +
      '<cMun>1302603</cMun>' +
      '<xMun>Manaus</xMun>' +
      '<UF>AM</UF>' +
      '<CEP>69000000</CEP>' +
      '<cPais>1058</cPais>' +
      '<xPais>Brasil</xPais>' +
      '</enderEmit>' +
      '<IE>000000000</IE>' +
      '<CRT>1</CRT>' +
      '</emit>' +
      '<dest>' +
      '<CNPJ>99999999000191</CNPJ>' +
      '<xNome>Cliente Teste</xNome>' +
      '<enderDest>' +
      '<xLgr>Rua Cliente</xLgr>' +
      '<nro>456</nro>' +
      '<xBairro>Centro</xBairro>' +
      '<cMun>1302603</cMun>' +
      '<xMun>Manaus</xMun>' +
      '<UF>AM</UF>' +
      '<CEP>69000000</CEP>' +
      '<cPais>1058</cPais>' +
      '<xPais>Brasil</xPais>' +
      '</enderDest>' +
      '<indIEDest>9</indIEDest>' +
      '</dest>' +
      '<det nItem="1">' +
      '<prod>' +
      '<cProd>001</cProd>' +
      '<cEAN>SEM GTIN</cEAN>' +
      '<xProd>Produto Teste</xProd>' +
      '<NCM>84713010</NCM>' +
      '<CFOP>5102</CFOP>' +
      '<uCom>UN</uCom>' +
      '<qCom>1.0000</qCom>' +
      '<vUnCom>100.00</vUnCom>' +
      '<vProd>100.00</vProd>' +
      '<cEANTrib>SEM GTIN</cEANTrib>' +
      '<uTrib>UN</uTrib>' +
      '<qTrib>1.0000</qTrib>' +
      '<vUnTrib>100.00</vUnTrib>' +
      '<indTot>1</indTot>' +
      '</prod>' +
      '<imposto>' +
      '<ICMS>' +
      '<ICMSSN102>' +
      '<orig>0</orig>' +
      '<CSOSN>102</CSOSN>' +
      '</ICMSSN102>' +
      '</ICMS>' +
      '<PIS>' +
      '<PISOutr>' +
      '<CST>99</CST>' +
      '<vBC>0.00</vBC>' +
      '<vPIS>0.00</vPIS>' +
      '</PISOutr>' +
      '</PIS>' +
      '<COFINS>' +
      '<COFINSOutr>' +
      '<CST>99</CST>' +
      '<vBC>0.00</vBC>' +
      '<vCOFINS>0.00</vCOFINS>' +
      '</COFINSOutr>' +
      '</COFINS>' +
      '</imposto>' +
      '</det>' +
      '<total>' +
      '<ICMSTot>' +
      '<vBC>0.00</vBC>' +
      '<vICMS>0.00</vICMS>' +
      '<vICMSDeson>0.00</vICMSDeson>' +
      '<vBCST>0.00</vBCST>' +
      '<vST>0.00</vST>' +
      '<vProd>100.00</vProd>' +
      '<vFrete>0.00</vFrete>' +
      '<vSeg>0.00</vSeg>' +
      '<vDesc>0.00</vDesc>' +
      '<vII>0.00</vII>' +
      '<vIPI>0.00</vIPI>' +
      '<vIPIDevol>0.00</vIPIDevol>' +
      '<vPIS>0.00</vPIS>' +
      '<vCOFINS>0.00</vCOFINS>' +
      '<vOutro>0.00</vOutro>' +
      '<vNF>100.00</vNF>' +
      '<vTotTrib>0.00</vTotTrib>' +
      '</ICMSTot>' +
      '</total>' +
      '<transp>' +
      '<modFrete>9</modFrete>' +
      '</transp>' +
      '<cob>' +
      '<fat>' +
      '<nFat>001</nFat>' +
      '<vOrig>100.00</vOrig>' +
      '<vDesc>0.00</vDesc>' +
      '<vLiq>100.00</vLiq>' +
      '</fat>' +
      '<dup>' +
      '<nDup>001</nDup>' +
      '<dVenc>2025-11-27</dVenc>' +
      '<vDup>100.00</vDup>' +
      '</dup>' +
      '</cob>' +
      '<pag>' +
      '<detPag>' +
      '<tPag>01</tPag>' +
      '<vPag>100.00</vPag>' +
      '</detPag>' +
      '</pag>' +
      '<infIntermed>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<idCadIntTran>123456</idCadIntTran>' +
      '</infIntermed>' +
      '<infRespTec>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<xContato>Teste</xContato>' +
      '<email>teste@teste.com</email>' +
      '<fone>92999999999</fone>' +
      '</infRespTec>' +
      '</infNFe>' +
      '</NFe>' +
      '</enviNFe>' +
      '</nfeDadosMsg>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Criar envelope SOAP para NFC-e
  createNFCeEnvelope() {
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
      '<NFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
      '<infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">' +
      '<ide>' +
      '<cUF>13</cUF>' +
      '<cNF>00000001</cNF>' +
      '<natOp>Venda</natOp>' +
      '<mod>65</mod>' +
      '<serie>1</serie>' +
      '<nNF>1</nNF>' +
      '<dhEmi>2025-10-27T12:00:00-03:00</dhEmi>' +
      '<tpNF>1</tpNF>' +
      '<idDest>1</idDest>' +
      '<cMunFG>1302603</cMunFG>' +
      '<tpImp>4</tpImp>' +
      '<tpEmis>1</tpEmis>' +
      '<cDV>0</cDV>' +
      '<tpAmb>2</tpAmb>' +
      '<procEmi>0</procEmi>' +
      '<verProc>1.0</verProc>' +
      '</ide>' +
      '<emit>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<xNome>LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME</xNome>' +
      '<xFant>Teste</xFant>' +
      '<enderEmit>' +
      '<xLgr>Rua Teste</xLgr>' +
      '<nro>123</nro>' +
      '<xBairro>Centro</xBairro>' +
      '<cMun>1302603</cMun>' +
      '<xMun>Manaus</xMun>' +
      '<UF>AM</UF>' +
      '<CEP>69000000</CEP>' +
      '<cPais>1058</cPais>' +
      '<xPais>Brasil</xPais>' +
      '</enderEmit>' +
      '<IE>000000000</IE>' +
      '<CRT>1</CRT>' +
      '</emit>' +
      '<dest>' +
      '<CPF>12345678901</CPF>' +
      '<xNome>Cliente Teste</xNome>' +
      '</dest>' +
      '<det nItem="1">' +
      '<prod>' +
      '<cProd>001</cProd>' +
      '<cEAN>SEM GTIN</cEAN>' +
      '<xProd>Produto Teste</xProd>' +
      '<NCM>84713010</NCM>' +
      '<CFOP>5102</CFOP>' +
      '<uCom>UN</uCom>' +
      '<qCom>1.0000</qCom>' +
      '<vUnCom>100.00</vUnCom>' +
      '<vProd>100.00</vProd>' +
      '<cEANTrib>SEM GTIN</cEANTrib>' +
      '<uTrib>UN</uTrib>' +
      '<qTrib>1.0000</qTrib>' +
      '<vUnTrib>100.00</vUnTrib>' +
      '<indTot>1</indTot>' +
      '</prod>' +
      '<imposto>' +
      '<ICMS>' +
      '<ICMSSN102>' +
      '<orig>0</orig>' +
      '<CSOSN>102</CSOSN>' +
      '</ICMSSN102>' +
      '</ICMS>' +
      '<PIS>' +
      '<PISOutr>' +
      '<CST>99</CST>' +
      '<vBC>0.00</vBC>' +
      '<vPIS>0.00</vPIS>' +
      '</PISOutr>' +
      '</PIS>' +
      '<COFINS>' +
      '<COFINSOutr>' +
      '<CST>99</CST>' +
      '<vBC>0.00</vBC>' +
      '<vCOFINS>0.00</vCOFINS>' +
      '</COFINSOutr>' +
      '</COFINS>' +
      '</imposto>' +
      '</det>' +
      '<total>' +
      '<ICMSTot>' +
      '<vBC>0.00</vBC>' +
      '<vICMS>0.00</vICMS>' +
      '<vICMSDeson>0.00</vICMSDeson>' +
      '<vBCST>0.00</vBCST>' +
      '<vST>0.00</vST>' +
      '<vProd>100.00</vProd>' +
      '<vFrete>0.00</vFrete>' +
      '<vSeg>0.00</vSeg>' +
      '<vDesc>0.00</vDesc>' +
      '<vII>0.00</vII>' +
      '<vIPI>0.00</vIPI>' +
      '<vIPIDevol>0.00</vIPIDevol>' +
      '<vPIS>0.00</vPIS>' +
      '<vCOFINS>0.00</vCOFINS>' +
      '<vOutro>0.00</vOutro>' +
      '<vNF>100.00</vNF>' +
      '<vTotTrib>0.00</vTotTrib>' +
      '</ICMSTot>' +
      '</total>' +
      '<transp>' +
      '<modFrete>9</modFrete>' +
      '</transp>' +
      '<pag>' +
      '<detPag>' +
      '<tPag>01</tPag>' +
      '<vPag>100.00</vPag>' +
      '</detPag>' +
      '</pag>' +
      '<infIntermed>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<idCadIntTran>123456</idCadIntTran>' +
      '</infIntermed>' +
      '<infRespTec>' +
      '<CNPJ>18053139000169</CNPJ>' +
      '<xContato>Teste</xContato>' +
      '<email>teste@teste.com</email>' +
      '<fone>92999999999</fone>' +
      '</infRespTec>' +
      '</infNFe>' +
      '</NFe>' +
      '</nfeDadosMsg>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Criar agente HTTPS com certificados
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

  // Headers para requisição
  getHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*'
    };
  }

  // Testar conectividade com NF-e
  async testNFeConnectivity() {
    console.log('\n📄 TESTANDO NF-e (Nota Fiscal Eletrônica)');
    console.log('=======================================');

    const url = 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4';
    console.log(`🌐 URL: ${url}`);

    const envelope = this.createNFeEnvelope();
    console.log(`📏 Envelope: ${envelope.length} caracteres`);

    try {
      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      console.log('🌐 Enviando NF-e...');

      const response = await axios.post(url, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ NF-e ENVIADA COM SUCESSO!');
      console.log(`📊 Status HTTP: ${response.status}`);

      // Analisar resposta
      this.analyzeResponse(response.data, 'NF-e');

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      console.log('❌ NF-e FALHOU');
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`🔍 Código do erro: ${error.code || 'N/A'}`);
      console.log(`📝 Mensagem: ${error.message}`);

      if (error.response?.data) {
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

  // Testar conectividade com NFC-e
  async testNFCeConnectivity() {
    console.log('\n🎫 TESTANDO NFC-e (Nota Fiscal de Consumidor Eletrônica)');
    console.log('=======================================================');

    const url = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
    console.log(`🌐 URL: ${url}`);

    const envelope = this.createNFCeEnvelope();
    console.log(`📏 Envelope: ${envelope.length} caracteres`);

    try {
      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      console.log('🌐 Enviando NFC-e...');

      const response = await axios.post(url, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ NFC-e ENVIADA COM SUCESSO!');
      console.log(`📊 Status HTTP: ${response.status}`);

      // Analisar resposta
      this.analyzeResponse(response.data, 'NFC-e');

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      console.log('❌ NFC-e FALHOU');
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`🔍 Código do erro: ${error.code || 'N/A'}`);
      console.log(`📝 Mensagem: ${error.message}`);

      if (error.response?.data) {
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

  // Analisar resposta
  analyzeResponse(responseData, type) {
    console.log(`\n📊 ANÁLISE DA RESPOSTA ${type}:`);
    console.log('='.repeat(30));

    try {
      // Procurar por códigos de status
      const statusMatch = responseData.match(/<cStat>(\d+)<\/cStat>/);
      const motivoMatch = responseData.match(/<xMotivo>([^<]+)<\/xMotivo>/);

      if (statusMatch) {
        const cStat = statusMatch[1];
        console.log(`📊 Código do Status: ${cStat}`);

        // Interpretar código
        this.interpretStatusCode(cStat, type);
      }

      if (motivoMatch) {
        console.log(`📝 Motivo: ${motivoMatch[1]}`);
      }

      // Verificar se foi autorizada
      const isAuthorized = statusMatch && statusMatch[1] === '100';
      console.log(`🚦 Resultado: ${isAuthorized ? '✅ AUTORIZADA' : '❌ REJEITADA/NÃO AUTORIZADA'}`);

    } catch (error) {
      console.log(`❌ Erro ao analisar resposta: ${error.message}`);
      console.log('📄 Resposta bruta:', responseData.substring(0, 500));
    }
  }

  // Interpretar código de status
  interpretStatusCode(cStat, type) {
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

    const description = statusCodes[cStat] || `🔍 Código ${cStat} - Verificar documentação ${type}`;
    console.log(`🔍 Interpretação: ${description}`);
  }

  // Executar comparação completa
  async runComparison() {
    console.log('🔄 COMPARAÇÃO NF-e vs NFC-e');
    console.log('===========================');
    console.log('Objetivo: Verificar por que NF-e funciona mas NFC-e não\n');

    try {
      await this.connect();
      await this.loadCertificates();

      console.log('📋 DIFERENÇAS PRINCIPAIS:');
      console.log('• NF-e: Modelo 55, destinatário pessoa jurídica');
      console.log('• NFC-e: Modelo 65, destinatário pessoa física');
      console.log('• Endpoints diferentes');
      console.log('• Estruturas SOAP diferentes');
      console.log('• Políticas de certificados podem variar\n');

      // Testar NF-e
      const nfeResult = await this.testNFeConnectivity();

      // Testar NFC-e
      const nfceResult = await this.testNFCeConnectivity();

      // Comparar resultados
      this.compareResults(nfeResult, nfceResult);

    } catch (error) {
      console.error('❌ Erro na comparação:', error.message);
    } finally {
      await this.disconnect();
    }
  }

  // Comparar resultados
  compareResults(nfeResult, nfceResult) {
    console.log('\n🎯 COMPARAÇÃO FINAL');
    console.log('===================');

    console.log('📄 NF-e:');
    console.log(`   • Sucesso: ${nfeResult.success ? 'SIM' : 'NÃO'}`);
    console.log(`   • Status HTTP: ${nfeResult.status || 'N/A'}`);
    console.log(`   • Erro SSL: ${nfeResult.code === 'EPROTO' ? 'SIM' : 'NÃO'}`);

    console.log('\n🎫 NFC-e:');
    console.log(`   • Sucesso: ${nfceResult.success ? 'SIM' : 'NÃO'}`);
    console.log(`   • Status HTTP: ${nfceResult.status || 'N/A'}`);
    console.log(`   • Erro SSL: ${nfceResult.code === 'EPROTO' ? 'SIM' : 'NÃO'}`);

    console.log('\n🔍 ANÁLISE:');

    if (nfeResult.success && !nfceResult.success) {
      console.log('✅ NF-e funciona, NFC-e falha');
      console.log('💡 POSSÍVEIS CAUSAS:');
      console.log('   1. NFC-e requer certificado ICP-Brasil (NF-e pode aceitar outros)');
      console.log('   2. Políticas diferentes de autenticação');
      console.log('   3. Endpoints com requisitos distintos');
      console.log('   4. NFC-e pode ter validações adicionais');
    } else if (nfeResult.success && nfceResult.success) {
      console.log('✅ Ambos funcionam - problema pode ser específico do envelope');
    } else if (!nfeResult.success && !nfceResult.success) {
      console.log('❌ Ambos falham - problema geral de certificados');
      if (nfeResult.code === 'EPROTO' && nfceResult.code === 'EPROTO') {
        console.log('🔒 Ambos falham com erro SSL - certificados rejeitados');
      }
    }

    console.log('\n📋 CONCLUSÃO:');
    console.log('   • NF-e endpoint: homnfe.sefaz.am.gov.br/services2/');
    console.log('   • NFC-e endpoint: homnfce.sefaz.am.gov.br/nfce-services/');
    console.log('   • Certificado atual: NÃO é ICP-Brasil');
    console.log('   • SEFAZ-AM pode ter políticas diferentes por modalidade');
  }
}

// Executar comparação
async function main() {
  const tester = new NFeVsNFCeTester();
  await tester.runComparison();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
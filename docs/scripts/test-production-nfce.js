// Script para testar NFC-e em produção com dados reais
// Usa o mesmo código de produção para verificar se erro 404 persiste

const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const { Client } = require('pg');

// Configuração do banco
const dbConfig = {
  connectionString: process.env.DATABASE_URL_MANAUS || "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15"
};

// Função de descriptografia (igual ao código de produção)
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

class ProductionNFCeTester {
  constructor() {
    this.client = new Client(dbConfig);
    this.certificadoKey = null;
    this.certificadoCrt = null;
    this.cscToken = null;
    this.cscId = null;
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Conectado ao banco de dados');
  }

  async disconnect() {
    await this.client.end();
  }

  // Carregar dados de produção (igual ao código real)
  async loadProductionData() {
    console.log('🔑 Carregando dados de produção...');

    const query = `
      SELECT
        "certificadoKey",
        "certificadoCrt",
        csc_nfce_id,
        csc_nfce_homologacao,
        csc_nfce_producao,
        nomecontribuinte,
        cgc,
        inscricaoestadual,
        logradouro,
        numero,
        municipio,
        uf,
        cep
      FROM db_manaus.dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoKey" != ''
        AND "certificadoCrt" IS NOT NULL
        AND "certificadoCrt" != ''
      LIMIT 1
    `;

    const result = await this.client.query(query);
    if (result.rows.length === 0) {
      throw new Error('Nenhum dado de empresa encontrado');
    }

    const row = result.rows[0];
    console.log(`🏢 Empresa: ${row.nomecontribuinte}`);
    console.log(`🏷️  CGC: ${row.cgc}`);

    // Descriptografar certificados
    this.certificadoKey = await decrypt(row.certificadoKey);
    this.certificadoCrt = await decrypt(row.certificadoCrt);

    if (!this.certificadoKey || !this.certificadoCrt) {
      throw new Error('Falha na descriptografia dos certificados');
    }

    // Carregar CSC (ambiente de produção)
    this.cscId = row.csc_nfce_id;
    const cscCriptografado = row.csc_nfce_producao;

    if (cscCriptografado) {
      this.cscToken = await decrypt(cscCriptografado);
      if (this.cscToken) {
        console.log(`🔢 CSC ID: ${this.cscId}`);
        console.log(`🔒 CSC Token: ${this.cscToken.substring(0, 10)}...`);
      }
    }

    console.log('✅ Dados de produção carregados');
    return row;
  }

  // Gerar XML NFC-e simplificado (baseado no código de produção)
  generateNFCeXML(empresaData) {
    const now = new Date();
    const dhEmi = now.toISOString().replace('T', ' ').substring(0, 19) + '-03:00';
    const serie = '1';
    const nNF = '1';
    const cNF = '00000001';
    const chaveBase = `13${now.getFullYear().toString().padStart(4, '0')}1302603${empresaData.cgc.replace(/\D/g, '').padStart(14, '0')}${serie.padStart(3, '0')}${nNF.padStart(9, '0')}1${cNF}`;

    // Calcular DV da chave
    const chaveSemDV = chaveBase.substring(0, 43);
    const dv = this.calcularDVChave(chaveSemDV);
    const chaveAcesso = chaveSemDV + dv;

    // Gerar QR Code
    const dadosQR = `chNFe=${chaveAcesso}&nVersao=100&tpAmb=1&dhEmi=${encodeURIComponent(dhEmi)}&vNF=100.00&vICMS=0.00&digVal=&cIdToken=${this.cscId}`;
    const hashQR = crypto.createHash('sha256').update(dadosQR + this.cscToken).digest('hex').substring(0, 32);
    const qrCode = `https://nfce.sefaz.am.gov.br/qrcode?chNFe=${chaveAcesso}&nVersao=100&tpAmb=1&dhEmi=${encodeURIComponent(dhEmi)}&vNF=100.00&vICMS=0.00&digVal=&cIdToken=${this.cscId}&cHashQRCode=${hashQR}`;

    const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe${chaveAcesso}" versao="4.00">
<ide>
<cUF>13</cUF>
<cNF>${cNF}</cNF>
<natOp>Venda</natOp>
<mod>65</mod>
<serie>${serie}</serie>
<nNF>${nNF}</nNF>
<dhEmi>${dhEmi}</dhEmi>
<tpNF>1</tpNF>
<idDest>1</idDest>
<cMunFG>1302603</cMunFG>
<tpImp>4</tpImp>
<tpEmis>1</tpEmis>
<cDV>${dv}</cDV>
<tpAmb>1</tpAmb>
<procEmi>0</procEmi>
<verProc>1.0</verProc>
</ide>
<emit>
<CNPJ>${empresaData.cgc.replace(/\D/g, '').padStart(14, '0')}</CNPJ>
<xNome>${empresaData.nomecontribuinte}</xNome>
<xFant>Teste</xFant>
<enderEmit>
<xLgr>${empresaData.logradouro}</xLgr>
<nro>${empresaData.numero}</nro>
<xBairro>Centro</xBairro>
<cMun>1302603</cMun>
<xMun>${empresaData.municipio}</xMun>
<UF>${empresaData.uf}</UF>
<CEP>${empresaData.cep.replace(/\D/g, '')}</CEP>
<cPais>1058</cPais>
<xPais>Brasil</xPais>
</enderEmit>
<IE>${empresaData.inscricaoestadual}</IE>
<CRT>1</CRT>
</emit>
<dest>
<CPF>12345678901</CPF>
<xNome>Cliente Teste</xNome>
</dest>
<det nItem="1">
<prod>
<cProd>001</cProd>
<cEAN>SEM GTIN</cEAN>
<xProd>Produto Teste</xProd>
<NCM>84713010</NCM>
<CFOP>5102</CFOP>
<uCom>UN</uCom>
<qCom>1.0000</qCom>
<vUnCom>100.00</vUnCom>
<vProd>100.00</vProd>
<cEANTrib>SEM GTIN</cEANTrib>
<uTrib>UN</uTrib>
<qTrib>1.0000</qTrib>
<vUnTrib>100.00</vUnTrib>
<indTot>1</indTot>
</prod>
<imposto>
<ICMS>
<ICMSSN102>
<orig>0</orig>
<CSOSN>102</CSOSN>
</ICMSSN102>
</ICMS>
<PIS>
<PISOutr>
<CST>99</CST>
<vBC>0.00</vBC>
<vPIS>0.00</vPIS>
</PISOutr>
</PIS>
<COFINS>
<COFINSOutr>
<CST>99</CST>
<vBC>0.00</vBC>
<vCOFINS>0.00</vCOFINS>
</COFINSOutr>
</COFINS>
</imposto>
</det>
<total>
<ICMSTot>
<vBC>0.00</vBC>
<vICMS>0.00</vICMS>
<vICMSDeson>0.00</vICMSDeson>
<vBCST>0.00</vBCST>
<vST>0.00</vST>
<vProd>100.00</vProd>
<vFrete>0.00</vFrete>
<vSeg>0.00</vSeg>
<vDesc>0.00</vDesc>
<vII>0.00</vII>
<vIPI>0.00</vIPI>
<vIPIDevol>0.00</vIPIDevol>
<vPIS>0.00</vPIS>
<vCOFINS>0.00</vCOFINS>
<vOutro>0.00</vOutro>
<vNF>100.00</vNF>
<vTotTrib>0.00</vTotTrib>
</ICMSTot>
</total>
<transp>
<modFrete>9</modFrete>
</transp>
<pag>
<detPag>
<tPag>01</tPag>
<vPag>100.00</vPag>
</detPag>
</pag>
<infIntermed>
<CNPJ>${empresaData.cgc.replace(/\D/g, '').padStart(14, '0')}</CNPJ>
<idCadIntTran>123456</idCadIntTran>
</infIntermed> 
<infRespTec>
<CNPJ>${empresaData.cgc.replace(/\D/g, '').padStart(14, '0')}</CNPJ>
<xContato>Teste</xContato>
<email>teste@teste.com</email>
<fone>92999999999</fone>
</infRespTec>
<infNFeSupl><qrCode>${qrCode}</qrCode></infNFeSupl>
</infNFe>
</NFe>`;

    return { xml, chaveAcesso, qrCode };
  }

  // Calcular DV da chave (módulo 11)
  calcularDVChave(chave43) {
    const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;

    for (let i = 0; i < 43; i++) {
      soma += parseInt(chave43[i]) * pesos[i];
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // Assinar XML (versão simplificada)
  async signXML(xml) {
    // Esta é uma versão simplificada - em produção usa biblioteca específica
    console.log('⚠️  Assinatura XML simplificada (apenas para teste)');
    // Não adicionar namespace duplicado
    return xml;
  }

  // Criar envelope SOAP NFC-e (correto)
  createSOAPEnvelope(xmlAssinado) {
    // Remover declaração XML do XML interno se existir
    const xmlSemDeclaracao = xmlAssinado.replace(/<\?xml[^>]*\?>/, '').trim();

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Header>
<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
<cUF>13</cUF>
<versaoDados>4.00</versaoDados>
</nfeCabecMsg>
</soap12:Header>
<soap12:Body>
<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
${xmlSemDeclaracao}
</nfeDadosMsg>
</soap12:Body>
</soap12:Envelope>`;
  }

  // Criar agente HTTPS
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

  // Headers da requisição
  getHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*'
    };
  }

  // Testar NFC-e em produção
  async testProductionNFCe() {
    console.log('🎫 TESTE NFC-e EM PRODUÇÃO');
    console.log('===========================');

    try {
      await this.connect();
      const empresaData = await this.loadProductionData();

      // Gerar XML
      console.log('📄 Gerando XML NFC-e...');
      const { xml, chaveAcesso, qrCode } = this.generateNFCeXML(empresaData);
      console.log(`🔑 Chave de Acesso: ${chaveAcesso}`);
      console.log(`📱 QR Code: ${qrCode.substring(0, 50)}...`);

      // Assinar XML
      const xmlAssinado = await this.signXML(xml);

      // Criar envelope SOAP
      const envelope = this.createSOAPEnvelope(xmlAssinado);
      console.log(`📏 Envelope SOAP: ${envelope.length} caracteres`);

      // Preparar requisição
      const url = 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
      console.log(`🌐 URL: ${url}`);

      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      // Salvar envelope para análise
      const fs = require('fs');
      fs.writeFileSync('envelope-nfce-test.xml', envelope);
      console.log('💾 Envelope salvo em: envelope-nfce-test.xml');

      console.log('🌐 Enviando NFC-e para SEFAZ-AM...');

      const response = await axios.post(url, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ NFC-e ENVIADO COM SUCESSO!');
      console.log(`📊 Status HTTP: ${response.status}`);

      // Analisar resposta
      this.analyzeResponse(response.data);

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
    } finally {
      await this.disconnect();
    }
  }

  // Analisar resposta
  analyzeResponse(responseData) {
    console.log(`\n📊 ANÁLISE DA RESPOSTA NFC-e:`);
    console.log('='.repeat(30));

    try {
      const statusMatch = responseData.match(/<cStat>(\d+)<\/cStat>/);
      const motivoMatch = responseData.match(/<xMotivo>([^<]+)<\/xMotivo>/);

      if (statusMatch) {
        const cStat = statusMatch[1];
        console.log(`📊 Código do Status: ${cStat}`);

        this.interpretStatusCode(cStat);
      }

      if (motivoMatch) {
        console.log(`📝 Motivo: ${motivoMatch[1]}`);
      }

      const isAuthorized = statusMatch && statusMatch[1] === '100';
      console.log(`🚦 Resultado: ${isAuthorized ? '✅ AUTORIZADA' : '❌ REJEITADA'}`);

    } catch (error) {
      console.log(`❌ Erro ao analisar resposta: ${error.message}`);
      console.log('📄 Resposta bruta:', responseData.substring(0, 500));
    }
  }

  // Interpretar código de status
  interpretStatusCode(cStat) {
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

    const description = statusCodes[cStat] || `🔍 Código ${cStat} - Verificar documentação`;
    console.log(`🔍 Interpretação: ${description}`);
  }

  // Executar teste completo
  async runTest() {
    console.log('🚀 TESTE NFC-e PRODUÇÃO COM DADOS REAIS');
    console.log('=======================================\n');

    const result = await this.testProductionNFCe();

    console.log('\n🎯 RESULTADO FINAL:');
    console.log('===================');

    if (result.success) {
      console.log('✅ NFC-e enviado com sucesso');
      console.log('💡 Certificado atual funciona para NFC-e');
      console.log('🔧 Problema pode estar no código de produção');
    } else if (result.code === 'EPROTO') {
      console.log('🔒 ERRO SSL/TLS - Certificado rejeitado');
      console.log('💡 Pode ser necessário certificado ICP-Brasil');
    } else if (result.status === 404) {
      console.log('🌐 ERRO 404 - Mesmo problema que código de produção');
      console.log('💡 Endpoint ou envelope incorreto');
    } else {
      console.log(`❌ Erro ${result.status} - Verificar resposta detalhada`);
    }

    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. 🔍 Comparar com código de produção');
    console.log('   2. 📄 Verificar envelope XML gerado');
    console.log('   3. 🎫 Testar CSC e QR code');
    console.log('   4. 📞 Contatar SEFAZ-AM se necessário');

    return result;
  }
}

// Executar teste
async function main() {
  const tester = new ProductionNFCeTester();
  await tester.runTest();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
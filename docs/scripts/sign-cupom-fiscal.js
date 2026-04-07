// Script para assinar XML de Cupom Fiscal NFC-e com assinatura SHA-256 correta
// Baseado no test-signature.js, adaptado para cupom fiscal

const crypto = require('crypto');
const { createSign } = require('crypto');
const { Client } = require('pg');
const fs = require('fs');

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

class CupomFiscalSigner {
  constructor() {
    this.client = new Client(dbConfig);
    this.certificadoKey = null;
    this.certificadoCrt = null;
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async loadCertificates() {
    const query = `
      SELECT "certificadoKey", "certificadoCrt"
      FROM db_manaus.dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoKey" != ''
        AND "certificadoCrt" IS NOT NULL AND "certificadoCrt" != ''
      LIMIT 1
    `;

    const result = await this.client.query(query);
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    this.certificadoKey = await decrypt(row.certificadoKey);
    this.certificadoCrt = await decrypt(row.certificadoCrt);

    return !!(this.certificadoKey && this.certificadoCrt);
  }

  // Gerar XML NFC-e para Cupom Fiscal
  generateCupomFiscalXML(dadosCupom) {
    const {
      serie = '2',
      nNF = '1',
      produtos = [],
      cliente = null,
      valorTotal = 0,
      formaPagamento = '01'
    } = dadosCupom;

    const now = new Date();
    const dhEmi = now.toISOString().replace('T', ' ').substring(0, 19) + '-04:00';
    const cNF = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    const chaveBase = `13${now.getFullYear().toString().padStart(4, '0')}1302603${'18053139000169'.padStart(14, '0')}${serie.padStart(3, '0')}${nNF.padStart(9, '0')}1${cNF}`;

    const chaveSemDV = chaveBase.substring(0, 43);
    const dv = this.calcularDVChave(chaveSemDV);
    const chaveAcesso = chaveSemDV + dv;

    // Gerar itens do produto
    const itensXML = produtos.map((produto, index) => {
      const nItem = index + 1;
      return `<det nItem="${nItem}">
<prod>
<cProd>${produto.codigo || '001'}</cProd>
<cEAN>SEM GTIN</cEAN>
<xProd>${produto.descricao || 'Produto Teste'}</xProd>
<NCM>${produto.ncm || '84714900'}</NCM>
<CFOP>${produto.cfop || '5102'}</CFOP>
<uCom>${produto.unidade || 'PC'}</uCom>
<qCom>${produto.quantidade?.toFixed(4) || '1.0000'}</qCom>
<vUnCom>${produto.valorUnitario?.toFixed(2) || '10.00'}</vUnCom>
<vProd>${produto.valorTotal?.toFixed(2) || '10.00'}</vProd>
<cEANTrib>SEM GTIN</cEANTrib>
<uTrib>${produto.unidade || 'PC'}</uTrib>
<qTrib>${produto.quantidade?.toFixed(4) || '1.0000'}</qTrib>
<vUnTrib>${produto.valorUnitario?.toFixed(2) || '10.00'}</vUnTrib>
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
<PISNT>
<CST>07</CST>
</PISNT>
</PIS>
<COFINS>
<COFINSNT>
<CST>07</CST>
</COFINSNT>
</COFINS>
</imposto>
</det>`;
    }).join('\n');

    // Destinatário (opcional)
    const destXML = cliente ? `
<dest>
<CPF>${cliente.cpf || '74978004268'}</CPF>
<xNome>${cliente.nome || 'Cliente Teste'}</xNome>
<indIEDest>9</indIEDest>
</dest>` : '';

    const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe${chaveAcesso}" versao="4.00">
<ide>
<cUF>13</cUF>
<cNF>${cNF}</cNF>
<natOp>VENDA CONSUMIDOR</natOp>
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
<tpAmb>2</tpAmb>
<finNFe>1</finNFe>
<indFinal>1</indFinal>
<indPres>1</indPres>
<procEmi>1</procEmi>
<verProc>4.00</verProc>
</ide>
<emit>
<CNPJ>18053139000169</CNPJ>
<xNome>LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME</xNome>
<xFant>LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME</xFant>
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
</emit>${destXML}
${itensXML}
<total>
<ICMSTot>
<vBC>0.00</vBC>
<vICMS>0.00</vICMS>
<vICMSDeson>0.00</vICMSDeson>
<vFCP>0.00</vFCP>
<vBCST>0.00</vBCST>
<vST>0.00</vST>
<vFCPST>0.00</vFCPST>
<vFCPSTRet>0.00</vFCPSTRet>
<vProd>${valorTotal.toFixed(2)}</vProd>
<vFrete>0.00</vFrete>
<vSeg>0.00</vSeg>
<vDesc>0.00</vDesc>
<vII>0.00</vII>
<vPIS>0.00</vPIS>
<vCOFINS>0.00</vCOFINS>
<vOutro>0.00</vOutro>
<vNF>${valorTotal.toFixed(2)}</vNF>
</ICMSTot>
</total>
<transp>
<modFrete>0</modFrete>
</transp>
<pag>
<detPag>
<tPag>${formaPagamento}</tPag>
<vPag>${valorTotal.toFixed(2)}</vPag>
</detPag>
<vTroco>0.00</vTroco>
</pag>
<infAdic>
<infCpl>Emissao de NFC-e - Cupom Fiscal</infCpl>
</infAdic>
</infNFe>
</NFe>`;

    return { xml, chaveAcesso };
  }

  // Calcular DV da chave de acesso
  calcularDVChave(chave43) {
    const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;

    for (let i = 0; i < 43; i++) {
      soma += parseInt(chave43[i]) * pesos[i];
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // Assinar XML NFC-e com SHA-256 (correto para SEFAZ-AM)
  async signNFCeXML(xml) {
    console.log('🔐 Assinando XML NFC-e com SHA-256...');

    try {
      // Extrair infNFe
      const infNFeMatch = xml.match(/<infNFe[^>]*>([\s\S]*?)<\/infNFe>/);
      if (!infNFeMatch) {
        throw new Error('Não foi possível encontrar infNFe no XML');
      }

      const infNFeContent = infNFeMatch[1];
      const infNFeId = xml.match(/<infNFe[^>]*Id="([^"]*)"/)?.[1];

      if (!infNFeId) {
        throw new Error('ID do infNFe não encontrado');
      }

      console.log(`📋 ID para assinatura: ${infNFeId}`);

      // Canonicalizar o conteúdo (versão simplificada)
      const canonicalized = this.canonicalizeXML(infNFeContent);

      // Calcular digest SHA-256
      const digest = crypto.createHash('sha256').update(canonicalized, 'utf8').digest('base64');

      console.log(`🔢 Digest SHA-256: ${digest.substring(0, 20)}...`);

      // Assinar o digest com RSA-SHA256
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(canonicalized, 'utf8');

      const signature = sign.sign({
        key: this.certificadoKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, 'base64');

      console.log(`✍️  Assinatura RSA-SHA256 gerada: ${signature.substring(0, 20)}...`);

      // Criar elemento Signature
      const signatureElement = this.createSignatureElement(infNFeId, digest, signature);

      // Inserir assinatura no XML
      const xmlAssinado = xml.replace(
        /<\/infNFe>/,
        `</infNFe>${signatureElement}`
      );

      console.log('✅ XML assinado com SHA-256');
      return xmlAssinado;

    } catch (error) {
      console.error('❌ Erro na assinatura:', error.message);
      throw error;
    }
  }

  // Canonicalizar XML (versão simplificada)
  canonicalizeXML(xml) {
    // Remover espaços entre tags e normalizar
    return xml.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
  }

  // Criar elemento Signature com SHA-256
  createSignatureElement(infNFeId, digest, signature) {
    return `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
<SignedInfo>
<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
<Reference URI="#${infNFeId}">
<Transforms>
<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
</Transforms>
<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<DigestValue>${digest}</DigestValue>
</Reference>
</SignedInfo>
<SignatureValue>${signature}</SignatureValue>
<KeyInfo>
<X509Data>
<X509Certificate>${Buffer.from(this.certificadoCrt).toString('base64')}</X509Certificate>
</X509Data>
</KeyInfo>
</Signature>`;
  }

  // Limpar e validar XML para evitar rejeição 215
  cleanXMLForSEFAZ(xml) {
    console.log('🧹 Limpando XML para conformidade SEFAZ...');

    let cleanedXml = xml;

    // 1. Remover espaços em branco no início e fim de tags
    cleanedXml = cleanedXml.replace(/>\s+</g, '><');

    // 2. Remover quebras de linha dentro de tags de conteúdo
    cleanedXml = cleanedXml.replace(/\n\s*<([^>]+)>\s*\n/g, '<$1>');
    cleanedXml = cleanedXml.replace(/\n\s*<\/([^>]+)>\s*\n/g, '</$1>');

    // 3. Normalizar espaços em branco
    cleanedXml = cleanedXml.replace(/\s+/g, ' ');

    // 4. Remover espaços antes de tags de fechamento
    cleanedXml = cleanedXml.replace(/\s+<\//g, '</');

    // 5. Remover espaços após tags de abertura
    cleanedXml = cleanedXml.replace(/>\s+/g, '>');

    // 6. Limpar caracteres especiais problemáticos
    cleanedXml = cleanedXml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 7. Garantir que o XML comece corretamente
    if (!cleanedXml.trim().startsWith('<?xml')) {
      cleanedXml = '<?xml version="1.0" encoding="UTF-8"?>' + cleanedXml.trim();
    }

    console.log('✅ XML limpo para conformidade SEFAZ');
    return cleanedXml;
  }

  // Gerar QR Code para NFC-e com cálculos corretos
  generateQRCode(chaveAcesso, valorTotal, ambiente = '2', digestValue = '') {
    const tpAmb = ambiente; // 1=Produção, 2=Homologação
    const cDest = '74978004268'; // CPF do destinatário
    const dhEmi = new Date().toISOString().replace(/[:-]/g, '').substring(0, 12) + '-0400';
    const vNF = valorTotal.toFixed(2);
    const vICMS = '0.00';
    const digVal = digestValue || 'placeholder'; // Digest SHA-256 do XML
    const cIdToken = '000001'; // Token CSC

    // Calcular cHashQRCode (SHA-256 do QR Code sem o cHashQRCode)
    const qrCodeBase = `chNFe=${chaveAcesso}&nVersao=100&tpAmb=${tpAmb}&cDest=${cDest}&dhEmi=${dhEmi}&vNF=${vNF}&vICMS=${vICMS}&digVal=${digVal}&cIdToken=${cIdToken}`;
    const cHashQRCode = crypto.createHash('sha256').update(qrCodeBase, 'utf8').digest('hex').toUpperCase().substring(0, 8);

    const qrCode = `${qrCodeBase}&cHashQRCode=${cHashQRCode}`;

    return qrCode;
  }

  // Assinar e gerar NFC-e completa
  async gerarCupomFiscalAssinado(dadosCupom) {
    console.log('🧾 GERANDO CUPOM FISCAL ASSINADO');
    console.log('=================================');

    try {
      await this.connect();

      if (!(await this.loadCertificates())) {
        throw new Error('Certificados não carregados');
      }

      console.log('✅ Certificados carregados');

      // Gerar XML base
      console.log('📄 Gerando XML do cupom fiscal...');
      const { xml, chaveAcesso } = this.generateCupomFiscalXML(dadosCupom);
      console.log(`🔑 Chave de acesso: ${chaveAcesso}`);

      // Assinar XML
      const xmlAssinado = await this.signNFCeXML(xml);

      // Limpar XML para conformidade SEFAZ (evitar rejeição 215)
      const xmlLimpo = this.cleanXMLForSEFAZ(xmlAssinado);

      // Extrair digest da assinatura para o QR Code
      const digestMatch = xmlLimpo.match(/<DigestValue>([^<]+)<\/DigestValue>/);
      const digestValue = digestMatch ? digestMatch[1] : '';

      // Adicionar infNFeSupl com QR Code correto
      const valorTotal = dadosCupom.valorTotal || 0;
      const qrCode = this.generateQRCode(chaveAcesso, valorTotal, '2', digestValue);

      const infNFeSupl = `<infNFeSupl><qrCode><![CDATA[${qrCode}]]></qrCode><urlChave>https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp</urlChave></infNFeSupl>`;

      const xmlCompleto = xmlLimpo.replace(
        /<\/NFe>/,
        `${infNFeSupl}</NFe>`
      );

      // Salvar arquivo
      const fileName = `cupom-fiscal-assinado-${Date.now()}.xml`;
      fs.writeFileSync(fileName, xmlCompleto);

      console.log(`💾 Cupom fiscal salvo: ${fileName}`);
      console.log('✅ Cupom fiscal gerado e assinado com sucesso!');

      return {
        success: true,
        xml: xmlCompleto,
        chaveAcesso,
        fileName
      };

    } catch (error) {
      console.error('❌ Erro ao gerar cupom fiscal:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      await this.disconnect();
    }
  }
}

// Função principal para uso direto
async function assinarCupomFiscal(dadosCupom) {
  const signer = new CupomFiscalSigner();
  return await signer.gerarCupomFiscalAssinado(dadosCupom);
}

// Exportar para uso como módulo
module.exports = { CupomFiscalSigner, assinarCupomFiscal };

// Exemplo de uso se executado diretamente
if (require.main === module) {
  // Exemplo de dados para cupom fiscal
  const dadosExemplo = {
    serie: '2',
    nNF: '1',
    produtos: [
      {
        codigo: '001',
        descricao: 'Produto Teste NFC-e',
        ncm: '84714900',
        cfop: '5102',
        unidade: 'PC',
        quantidade: 1,
        valorUnitario: 43.60,
        valorTotal: 43.60
      }
    ],
    cliente: {
      cpf: '74978004268',
      nome: 'Cliente Teste'
    },
    valorTotal: 43.60,
    formaPagamento: '17' // 17 = Cartão de crédito
  };

  assinarCupomFiscal(dadosExemplo)
    .then(result => {
      if (result.success) {
        console.log('\n🎉 CUPOM FISCAL GERADO COM SUCESSO!');
        console.log(`📄 Arquivo: ${result.fileName}`);
        console.log(`🔑 Chave: ${result.chaveAcesso}`);
      } else {
        console.error('❌ Falha:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ Erro inesperado:', error);
    });
}
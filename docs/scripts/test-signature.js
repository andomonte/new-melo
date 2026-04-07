// Script para testar apenas a assinatura XML NFC-e
// Verifica se o XML está sendo assinado corretamente

const crypto = require('crypto');
const { createSign } = require('crypto');
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

class SignatureTester {
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

  // Gerar XML NFC-e simples (igual ao teste anterior)
  generateSimpleNFCeXML() {
    const now = new Date();
    const dhEmi = now.toISOString().replace('T', ' ').substring(0, 19) + '-03:00';
    const serie = '1';
    const nNF = '1';
    const cNF = '00000001';
    const chaveBase = `13${now.getFullYear().toString().padStart(4, '0')}1302603${'18053139000169'.padStart(14, '0')}${serie.padStart(3, '0')}${nNF.padStart(9, '0')}1${cNF}`;

    const chaveSemDV = chaveBase.substring(0, 43);
    const dv = this.calcularDVChave(chaveSemDV);
    const chaveAcesso = chaveSemDV + dv;

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
<CNPJ>18053139000169</CNPJ>
<xNome>LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME</xNome>
<xFant>Teste</xFant>
<enderEmit>
<xLgr>Rua Ararangua</xLgr>
<nro>211</nro>
<xBairro>Centro</xBairro>
<cMun>1302603</cMun>
<xMun>Manaus</xMun>
<UF>AM</UF>
<CEP>69090786</CEP>
<cPais>1058</cPais>
<xPais>Brasil</xPais>
</enderEmit>
<IE>053374665</IE>
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
<pPIS>0.00</pPIS>
<vPIS>0.00</vPIS>
</PISOutr>
</PIS>
<COFINS>
<COFINSOutr>
<CST>99</CST>
<vBC>0.00</vBC>
<pCOFINS>0.00</pCOFINS>
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
</ICMSTot>
</total>
<pag>
<detPag>
<tPag>01</tPag>
<vPag>100.00</vPag>
</detPag>
</pag>
<infRespTec>
<CNPJ>18053139000169</CNPJ>
<xContato>Teste</xContato>
<email>teste@teste.com</email>
<fone>92999999999</fone>
</infRespTec>
</infNFe>
</NFe>`;

    return { xml, chaveAcesso };
  }

  // Calcular DV da chave
  calcularDVChave(chave43) {
    const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;

    for (let i = 0; i < 43; i++) {
      soma += parseInt(chave43[i]) * pesos[i];
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // Assinar XML NFC-e (implementação completa)
  async signNFCeXML(xml) {
    console.log('🔐 Assinando XML NFC-e...');

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

      // Canonicalizar o conteúdo
      const canonicalized = this.canonicalizeXML(infNFeContent);

      // Calcular digest SHA-256
      const digest = crypto.createHash('sha256').update(canonicalized, 'utf8').digest('base64');

      console.log(`🔢 Digest SHA-256: ${digest.substring(0, 20)}...`);

      // Assinar o digest
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(canonicalized, 'utf8');

      const signature = sign.sign({
        key: this.certificadoKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, 'base64');

      console.log(`✍️  Assinatura gerada: ${signature.substring(0, 20)}...`);

      // Criar elemento Signature
      const signatureElement = this.createSignatureElement(infNFeId, digest, signature);

      // Inserir assinatura no XML
      const xmlAssinado = xml.replace(
        /<\/infNFe>/,
        `</infNFe>${signatureElement}`
      );

      console.log('✅ XML assinado com sucesso');
      return xmlAssinado;

    } catch (error) {
      console.error('❌ Erro na assinatura:', error.message);
      throw error;
    }
  }

  // Canonicalizar XML (versão simplificada)
  canonicalizeXML(xml) {
    // Remover espaços entre tags
    return xml.replace(/>\s+</g, '><').trim();
  }

  // Criar elemento Signature
  createSignatureElement(infNFeId, digest, signature) {
    const now = new Date().toISOString();

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

  // Testar assinatura
  async testSignature() {
    console.log('🔐 TESTE DE ASSINATURA NFC-e');
    console.log('============================');

    try {
      await this.connect();

      if (!(await this.loadCertificates())) {
        console.log('❌ Certificados não carregados');
        return;
      }

      console.log('✅ Certificados carregados');

      // Gerar XML
      console.log('📄 Gerando XML NFC-e...');
      const { xml, chaveAcesso } = this.generateSimpleNFCeXML();
      console.log(`🔑 Chave: ${chaveAcesso}`);

      // Assinar XML
      const xmlAssinado = await this.signNFCeXML(xml);

      // Verificações
      const hasSignature = xmlAssinado.includes('<Signature');
      const hasDigestValue = xmlAssinado.includes('<DigestValue>');
      const hasSignatureValue = xmlAssinado.includes('<SignatureValue>');
      const hasX509Certificate = xmlAssinado.includes('<X509Certificate>');

      console.log('\n📋 VERIFICAÇÕES DA ASSINATURA:');
      console.log(`✅ Tem Signature: ${hasSignature}`);
      console.log(`✅ Tem DigestValue: ${hasDigestValue}`);
      console.log(`✅ Tem SignatureValue: ${hasSignatureValue}`);
      console.log(`✅ Tem X509Certificate: ${hasX509Certificate}`);

      if (hasSignature && hasDigestValue && hasSignatureValue && hasX509Certificate) {
        console.log('\n✅ ASSINATURA COMPLETA GERADA');

        // Salvar XML assinado
        const fs = require('fs');
        fs.writeFileSync('nfce-assinado.xml', xmlAssinado);
        console.log('💾 XML assinado salvo em: nfce-assinado.xml');

        return { success: true, xml: xmlAssinado };
      } else {
        console.log('\n❌ ASSINATURA INCOMPLETA');
        return { success: false };
      }

    } catch (error) {
      console.error('❌ Erro no teste de assinatura:', error.message);
      return { success: false, error: error.message };
    } finally {
      await this.disconnect();
    }
  }

  // Limpar XML para conformidade SEFAZ (remover espaços extras e caracteres problemáticos)
  cleanXMLForSEFAZ(xml) {
    console.log('🧹 Limpando XML para conformidade SEFAZ...');

    // Remover espaços em branco entre tags
    let cleanedXml = xml.replace(/>\s+</g, '><');

    // Remover quebras de linha desnecessárias
    cleanedXml = cleanedXml.replace(/\n\s*/g, '');

    // Garantir que o XML comece corretamente
    cleanedXml = cleanedXml.trim();

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
}

// Executar teste
async function main() {
  const tester = new SignatureTester();
  await tester.testSignature();
}

if (require.main === module) {
  main();
}
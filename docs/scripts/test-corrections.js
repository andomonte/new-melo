// Teste completo NFC-e com correção automática do infNFeSupl
const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const { Client } = require('pg');
const fs = require('fs');

const dbConfig = {
  connectionString: process.env.DATABASE_URL_MANAUS || "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15"
};

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

class NFCeCompleteTest {
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

  // Corrigir infNFeSupl automaticamente
  fixInfNFeSupl(xml) {
    console.log('🔧 Verificando posicionamento do infNFeSupl...');

    // Verificar se infNFeSupl está fora de NFe
    const hasIssue = xml.includes('</Signature><infNFeSupl>') && 
                     !xml.includes('</infNFeSupl></NFe>');

    if (!hasIssue) {
      console.log('   ✅ infNFeSupl já está correto\n');
      return xml;
    }

    console.log('   ⚠️  infNFeSupl está FORA de <NFe>');
    console.log('   🔧 Movendo para dentro...');

    // Extrair infNFeSupl
    const infNFeSuplMatch = xml.match(/<infNFeSupl>[\s\S]*?<\/infNFeSupl>/);
    if (!infNFeSuplMatch) {
      console.log('   ❌ Não foi possível encontrar infNFeSupl');
      return xml;
    }

    const infNFeSuplBlock = infNFeSuplMatch[0];

    // Remover da posição atual
    let fixedXml = xml.replace(infNFeSuplBlock, '');

    // Inserir antes de </NFe>
    fixedXml = fixedXml.replace('</NFe>', `${infNFeSuplBlock}</NFe>`);

    console.log('   ✅ infNFeSupl movido para dentro de <NFe>\n');
    return fixedXml;
  }

  extractNFeFromBadXml(xmlContent) {
    let xml = xmlContent;
    
    // Remover envelope SOAP incorreto
    xml = xml.replace(/<soap12:Envelope[^>]*>/g, '');
    xml = xml.replace(/<\/soap12:Envelope>/g, '');
    xml = xml.replace(/<soap12:Body[^>]*>/g, '');
    xml = xml.replace(/<\/soap12:Body>/g, '');
    xml = xml.replace(/<nfeAutorizacaoLote[^>]*>/g, '');
    xml = xml.replace(/<\/nfeAutorizacaoLote>/g, '');
    xml = xml.replace(/<nfeDadosMsg[^>]*>/g, '');
    xml = xml.replace(/<\/nfeDadosMsg>/g, '');
    xml = xml.replace(/<enviNFe[^>]*>/g, '');
    xml = xml.replace(/<\/enviNFe>/g, '');
    xml = xml.replace(/<indSinc>.*?<\/indSinc>/g, '');
    
    xml = xml.trim();
    
    // Extrair NFe
    const nfeMatch = xml.match(/<NFe[^>]*>[\s\S]*?<\/infNFeSupl><\/NFe>/);
    if (!nfeMatch) {
      // Tentar sem infNFeSupl dentro
      const nfeMatch2 = xml.match(/<NFe[^>]*>[\s\S]*?<\/NFe>/);
      if (!nfeMatch2) {
        throw new Error('Elemento NFe não encontrado');
      }
      
      // Pegar também o infNFeSupl que pode estar depois
      const infNFeSuplMatch = xml.match(/<infNFeSupl>[\s\S]*?<\/infNFeSupl>/);
      if (infNFeSuplMatch) {
        // Montar NFe completa com infNFeSupl
        return nfeMatch2[0].replace('</NFe>', `${infNFeSuplMatch[0]}</NFe>`);
      }
      
      return nfeMatch2[0];
    }
    
    return nfeMatch[0];
  }

  createCorrectSoap12Envelope(xmlNFe) {
    const nfeClean = xmlNFe.trim();
    
    // Gerar ID de lote aleatório maior
    const idLote = Math.floor(Math.random() * 900000000000000) + 100000000000000;

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
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<idLote>${idLote}</idLote>
<indSinc>1</indSinc>
${nfeClean}
</enviNFe>
</nfeDadosMsg>
</soap12:Body>
</soap12:Envelope>`;
  }

  getCorrectHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
      'Content-Length': Buffer.byteLength(envelope, 'utf8')
    };
  }

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

  // Aplicar todas as correções necessárias no XML NFC-e
  applyAllCorrections(xmlNFe) {
    let correctedXml = xmlNFe;
    
    console.log('🔧 Aplicando correções no XML NFC-e...');
    
    // 1. Corrigir cEAN e cEANTrib vazios
    correctedXml = correctedXml.replace(/<cEAN\/>/g, '<cEAN>SEM GTIN</cEAN>');
    correctedXml = correctedXml.replace(/<cEANTrib\/>/g, '<cEANTrib>SEM GTIN</cEANTrib>');
    console.log('   ✅ cEAN/cEANTrib corrigidos para "SEM GTIN"');
    
    // 2. Adicionar tag <infAdic> obrigatória na posição correta (após </transp>)
    if (!correctedXml.includes('<infAdic>')) {
      correctedXml = correctedXml.replace(
        '</transp>',
        '</transp>\n<infAdic>\n  <infCpl>Emissao de NF-e de simples remessa</infCpl>\n</infAdic>'
      );
      console.log('   ✅ Tag <infAdic> obrigatória adicionada na posição correta');
    }
    
    // 3. Corrigir QR Code para ter URL completa
    correctedXml = correctedXml.replace(
      /<qrCode><!\[CDATA\[chNFe=/g,
      '<qrCode><![CDATA[https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe='
    );
    console.log('   ✅ QR Code corrigido com URL completa');
    
    // 4. Verificar assinatura SHA-1 (por enquanto manter como está)
    if (correctedXml.includes('rsa-sha1') || correctedXml.includes('sha1')) {
      console.log('   ⚠️  Assinatura usa SHA-1 (deve ser SHA-256 para NFC-e)');
      console.log('      Mantendo SHA-1 por enquanto - correção complexa');
    }
    
    console.log('✅ Todas as correções aplicadas\n');
    return correctedXml;
  }

  validateNFeStructure(xmlNFe) {
    console.log('🔍 VALIDANDO ESTRUTURA DA NFe:');
    console.log('==============================');

    const checks = {
      'infNFe': xmlNFe.includes('<infNFe'),
      'Signature': xmlNFe.includes('<Signature'),
      'infNFeSupl dentro de NFe': xmlNFe.includes('</infNFeSupl></NFe>'),
      'qrCode': xmlNFe.includes('<qrCode>'),
      'CDATA': xmlNFe.includes('<![CDATA[')
    };

    let allGood = true;
    Object.entries(checks).forEach(([name, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${name}`);
      if (!passed) allGood = false;
    });

    console.log('');
    return allGood;
  }

  async testNFCe() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   TESTE COMPLETO NFC-e COM AUTO-CORREÇÃO         ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    try {
      await this.connect();

      if (!(await this.loadCertificates())) {
        console.log('❌ Certificados não carregados');
        return { success: false, error: 'Certificados não encontrados' };
      }

      console.log('✅ Certificados carregados\n');

      const xmlPath = 'scripts/envelope-exemplo-corrigido.xml';
      
      if (!fs.existsSync(xmlPath)) {
        console.log(`❌ Arquivo ${xmlPath} não encontrado`);
        return { success: false, error: 'Arquivo XML não encontrado' };
      }
      
      const xmlCompleto = fs.readFileSync(xmlPath, 'utf8');
      console.log(`📄 XML carregado: ${xmlCompleto.length} caracteres\n`);

      console.log('🔧 Extraindo e corrigindo NFe...\n');
      let xmlNFe = this.extractNFeFromBadXml(xmlCompleto);
      console.log(`📦 NFe extraída: ${xmlNFe.length} caracteres\n`);

      // Aplicar todas as correções necessárias
      xmlNFe = this.applyAllCorrections(xmlNFe);

      // Aplicar correção do infNFeSupl
      xmlNFe = this.fixInfNFeSupl(xmlNFe);

      // Validar estrutura
      if (!this.validateNFeStructure(xmlNFe)) {
        throw new Error('NFe com estrutura inválida após correções');
      }

      // Criar envelope
      console.log('📦 Criando envelope SOAP 1.2...');
      const envelope = this.createCorrectSoap12Envelope(xmlNFe);
      console.log(`✅ Envelope criado: ${envelope.length} caracteres\n`);

      // Salvar para debug
      fs.writeFileSync('envelope-final-corrigido.xml', envelope);
      console.log('💾 Envelope salvo: envelope-final-corrigido.xml\n');

      const url = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
      const agent = this.createHttpsAgent();
      const headers = this.getCorrectHeaders(envelope);

      console.log('🌐 Enviando para SEFAZ-AM...');
      console.log(`   URL: ${url}`);
      console.log('   ⏳ Aguardando resposta...\n');

      const response = await axios.post(url, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ RESPOSTA RECEBIDA!');
      console.log(`📊 Status HTTP: ${response.status}\n`);

      this.analyzeResponse(response.data);

      return { 
        success: true, 
        status: response.status, 
        data: response.data 
      };

    } catch (error) {
      console.log('\n❌ ERRO NO ENVIO');
      console.log('='.repeat(50));
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`📝 ${error.message}`);

      if (error.response?.data) {
        const data = error.response.data;
        
        const cStatMatch = data.match(/<cStat>(\d+)<\/cStat>/);
        const xMotivoMatch = data.match(/<xMotivo>([^<]+)<\/xMotivo>/);
        
        if (cStatMatch || xMotivoMatch) {
          console.log('');
          if (cStatMatch) {
            console.log(`🔴 Código SEFAZ: ${cStatMatch[1]}`);
          }
          if (xMotivoMatch) {
            console.log(`🔴 Motivo: ${xMotivoMatch[1]}`);
          }
        }

        fs.writeFileSync('resposta-erro-sefaz.xml', data);
        console.log('\n💾 Resposta salva: resposta-erro-sefaz.xml');
      }

      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        response: error.response?.data
      };
    } finally {
      await this.disconnect();
    }
  }

  analyzeResponse(responseData) {
    console.log('📊 ANÁLISE DA RESPOSTA');
    console.log('='.repeat(50));

    try {
      const cStatMatch = responseData.match(/<cStat>(\d+)<\/cStat>/);
      const xMotivoMatch = responseData.match(/<xMotivo>([^<]+)<\/xMotivo>/);
      const chNFeMatch = responseData.match(/<chNFe>(\d+)<\/chNFe>/);
      const nProtMatch = responseData.match(/<nProt>(\d+)<\/nProt>/);

      if (cStatMatch) {
        const cStat = cStatMatch[1];
        
        if (cStat === '100') {
          console.log('');
          console.log('🎉🎉🎉 NFC-e AUTORIZADA COM SUCESSO! 🎉🎉🎉');
          console.log('');
          
          if (chNFeMatch) {
            console.log(`🔑 Chave: ${chNFeMatch[1]}`);
          }
          
          if (nProtMatch) {
            console.log(`📋 Protocolo: ${nProtMatch[1]}`);
          }
          
          console.log('');
          console.log('✅ O problema foi resolvido!');
          console.log('✅ Agora atualize seu código de produção com as correções');
        } else {
          console.log(`\n❌ NFC-e REJEITADA`);
          console.log(`📊 Código: ${cStat}`);
          
          if (xMotivoMatch) {
            console.log(`📝 Motivo: ${xMotivoMatch[1]}`);
          }
        }
      }

      fs.writeFileSync('resposta-sefaz-final.xml', responseData);
      console.log('\n💾 Resposta salva: resposta-sefaz-final.xml');

    } catch (error) {
      console.log(`❌ Erro ao analisar: ${error.message}`);
    }
  }
}

async function main() {
  const tester = new NFCeCompleteTest();
  const result = await tester.testNFCe();

  console.log('\n' + '='.repeat(60));
  console.log('🎯 RESULTADO FINAL');
  console.log('='.repeat(60));

  if (result.success) {
    console.log('✅ Teste concluído - verifique análise acima');
  } else {
    console.log('❌ Teste falhou - verifique erros acima');
  }

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = NFCeCompleteTest;
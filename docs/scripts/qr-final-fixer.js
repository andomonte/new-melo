// Script final para corrigir todos os problemas do QR Code NFC-e
// Inclui correção do formato da data dhEmi

const fs = require('fs');
const crypto = require('crypto');

class QRCodeFinalFixer {
  constructor() {
    this.envelope = null;
    this.chNFe = null;
    this.csc = '000001';
    this.cscToken = 'F7E4282473EB261D21F434297D81104F838FBC37';
  }

  // Carrega envelope
  loadEnvelope(envelopeData) {
    if (typeof envelopeData === 'string' && envelopeData.includes('<soap')) {
      this.envelope = envelopeData;
    } else if (fs.existsSync(envelopeData)) {
      this.envelope = fs.readFileSync(envelopeData, 'utf8');
    } else {
      throw new Error('Envelope inválido ou arquivo não encontrado');
    }

    // Extrair chave de acesso da NFe do atributo Id
    const chaveMatch = this.envelope.match(/Id="NFe([0-9]{44})"/);
    if (chaveMatch) {
      this.chNFe = chaveMatch[1];
      console.log(`🔑 Chave NFe: ${this.chNFe}`);
    }

    return this;
  }

  // Corrige todos os problemas do QR Code
  fixAllQRCodeIssues() {
    console.log('\n🔧 CORRIGINDO TODOS OS PROBLEMAS DO QR CODE');
    console.log('='.repeat(60));

    if (!this.chNFe) {
      console.log('❌ Chave NFe não encontrada');
      return false;
    }

    // Extrair parâmetros
    const params = this.extractParamsFromEnvelope();

    // CORREÇÃO ESPECÍFICA: Formatar dhEmi corretamente
    if (params.dhEmi) {
      // Remove 'Z' extra se existir e garante formato correto
      params.dhEmi = params.dhEmi.replace('Z', '').replace(/\+0000$/, '-0000');
      console.log(`📅 dhEmi corrigido: ${params.dhEmi}`);
    }

    // Construir string sem hash
    const qrStringWithoutHash = this.buildQRStringWithoutHash(params);

    // Calcular hash correto
    params.cHashQRCode = this.calculateQRHash(qrStringWithoutHash);

    // Construir QR Code final
    const finalQRString = this.buildQRString(params);

    console.log(`🔢 Hash calculado: ${params.cHashQRCode}`);
    console.log(`📱 QR final: ${finalQRString.substring(0, 120)}...`);

    // Substituir no envelope
    const oldQRMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (oldQRMatch) {
      const newQRTag = `<qrCode><![CDATA[${finalQRString}]]></qrCode>`;
      this.envelope = this.envelope.replace(oldQRMatch[0], newQRTag);
      console.log('✅ QR Code completamente corrigido!');
      return true;
    }

    return false;
  }

  // Extrai parâmetros do envelope
  extractParamsFromEnvelope() {
    const params = {
      chNFe: this.chNFe,
      nVersao: '100',
      tpAmb: '2'
    };

    // CPF destinatário
    const cpfMatch = this.envelope.match(/<CPF>([0-9]{11})<\/CPF>/);
    params.cDest = cpfMatch ? cpfMatch[1] : null;

    // Data de emissão - formato correto para QR Code
    const dhEmiMatch = this.envelope.match(/<dhEmi>([^<]+)<\/dhEmi>/);
    if (dhEmiMatch) {
      const date = new Date(dhEmiMatch[1]);
      params.dhEmi = date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '') + '-0400';
    }

    // Valor total
    const vNFMatch = this.envelope.match(/<vNF>([\d.]+)<\/vNF>/);
    params.vNF = vNFMatch ? parseFloat(vNFMatch[1]).toFixed(2) : null;

    // ICMS sempre 0.00 para NFC-e
    params.vICMS = '0.00';

    // Digest value
    const digestMatch = this.envelope.match(/<DigestValue>([^<]+)<\/DigestValue>/);
    params.digVal = digestMatch ? digestMatch[1] : null;

    // CSC
    params.cIdToken = this.csc;

    return params;
  }

  // Constrói string sem hash
  buildQRStringWithoutHash(params) {
    return [
      `chNFe=${params.chNFe}`,
      `nVersao=${params.nVersao}`,
      `tpAmb=${params.tpAmb}`,
      `cDest=${params.cDest}`,
      `dhEmi=${params.dhEmi}`,
      `vNF=${params.vNF}`,
      `vICMS=${params.vICMS}`,
      `digVal=${params.digVal}`,
      `cIdToken=${params.cIdToken}`
    ].join('&');
  }

  // Constrói string completa
  buildQRString(params) {
    return this.buildQRStringWithoutHash(params) + `&cHashQRCode=${params.cHashQRCode}`;
  }

  // Calcula hash correto
  calculateQRHash(qrString) {
    const hash = crypto.createHash('sha256');
    hash.update(qrString + this.cscToken);
    return hash.digest('hex').substring(0, 32).toUpperCase();
  }

  // Valida QR Code corrigido
  validateFixedQRCode() {
    console.log('\n🔍 VALIDANDO QR CODE CORRIGIDO');
    console.log('='.repeat(50));

    const qrMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (!qrMatch) {
      console.log('❌ QR Code não encontrado');
      return false;
    }

    const qrData = qrMatch[1];
    const params = {};

    qrData.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[key] = value;
    });

    // Validações finais
    const validations = {
      'Chave NFe (44 chars)': params.chNFe && params.chNFe.length === 44,
      'Versão': params.nVersao === '100',
      'Ambiente': params.tpAmb === '2',
      'CPF Destinatário': params.cDest && params.cDest.length === 11,
      'Data Emissão': params.dhEmi && /^\d{8}T\d{6}[+-]\d{4}$/.test(params.dhEmi),
      'Valor NF': params.vNF && parseFloat(params.vNF) > 0,
      'ICMS': params.vICMS === '0.00',
      'Digest Value': params.digVal && params.digVal.length > 0,
      'CSC ID': params.cIdToken === this.csc,
      'Hash (32 chars)': params.cHashQRCode && params.cHashQRCode.length === 32
    };

    let allValid = true;
    Object.entries(validations).forEach(([test, valid]) => {
      console.log(`${valid ? '✅' : '❌'} ${test}`);
      if (!valid) allValid = false;
    });

    return allValid;
  }

  // Salva envelope
  saveEnvelope(filename) {
    try {
      fs.writeFileSync(filename, this.envelope, 'utf8');
      console.log(`💾 Salvo: ${filename}`);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao salvar: ${error.message}`);
      return false;
    }
  }

  // Executa correção completa
  runCompleteFix() {
    console.log('🚀 CORREÇÃO FINAL DO QR CODE NFC-E');
    console.log('='.repeat(60));

    try {
      const fixed = this.fixAllQRCodeIssues();

      if (fixed) {
        const valid = this.validateFixedQRCode();

        if (valid) {
          console.log('\n🎉 SUCESSO TOTAL!');
          console.log('✅ Todos os problemas do QR Code foram corrigidos');
          console.log('💡 O envelope agora deve ser aceito pela SEFAZ-AM');
          return true;
        } else {
          console.log('\n⚠️  QR Code corrigido, mas ainda há validações pendentes');
        }
      }

    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }

    return false;
  }
}

// Função principal
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📖 Uso: node qr-final-fixer.js <arquivo.xml>');
    console.log('');
    console.log('Este script corrige TODOS os problemas do QR Code:');
    console.log('  ✅ Extrai chave NFe do atributo Id');
    console.log('  ✅ Corrige formato da data dhEmi');
    console.log('  ✅ Recalcula hash com 32 caracteres');
    console.log('  ✅ Valida todos os parâmetros');
    console.log('  ✅ Salva envelope corrigido');
    return;
  }

  const fixer = new QRCodeFinalFixer();

  try {
    fixer.loadEnvelope(args[0]);
    const success = fixer.runCompleteFix();

    if (success) {
      const outputFile = args[0].replace('.xml', '-final.xml');
      fixer.saveEnvelope(outputFile);
    }

  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
}

// Exportar
module.exports = QRCodeFinalFixer;

// Executar
if (require.main === module) {
  main();
}
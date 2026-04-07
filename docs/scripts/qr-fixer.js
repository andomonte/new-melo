// Script para corrigir problemas específicos do QR Code NFC-e
// Foca nos problemas identificados: chNFe faltando e cHashQRCode com tamanho errado

const fs = require('fs');
const crypto = require('crypto');

class QRCodeFixer {
  constructor() {
    this.envelope = null;
    this.chNFe = null;
    this.csc = '000001'; // CSC padrão
    this.cscToken = 'F7E4282473EB261D21F434297D81104F838FBC37'; // CSC Token
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

    // Extrair chave de acesso da NFe
    const chaveMatch = this.envelope.match(/<chNFe>([0-9]{44})<\/chNFe>/);
    if (chaveMatch) {
      this.chNFe = chaveMatch[1];
      console.log(`🔑 Chave NFe extraída: ${this.chNFe}`);
    } else {
      console.log('❌ Chave NFe não encontrada no envelope');
    }

    return this;
  }

  // Testa o QR Code atual
  testCurrentQRCode() {
    console.log('\n🔍 ANALISANDO QR CODE ATUAL');
    console.log('='.repeat(50));

    const qrMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (!qrMatch) {
      console.log('❌ QR Code não encontrado');
      return false;
    }

    const qrData = qrMatch[1];
    console.log(`📱 QR Code: ${qrData.substring(0, 100)}...`);

    // Parse dos parâmetros
    const params = {};
    qrData.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[key] = value;
    });

    console.log('\n📋 PARÂMETROS DO QR CODE:');
    Object.entries(params).forEach(([key, value]) => {
      const status = this.validateParam(key, value);
      console.log(`${status} ${key}: ${value || 'VAZIO'}`);
    });

    return params;
  }

  // Valida parâmetro individual
  validateParam(key, value) {
    const validations = {
      chNFe: value && value.length === 44,
      nVersao: value === '100',
      tpAmb: value === '2',
      cDest: value && value.length === 11,
      dhEmi: value && /^\d{8}T\d{6}[+-]\d{4}$/.test(value),
      vNF: value && parseFloat(value) > 0,
      vICMS: value === '0.00',
      digVal: value && value.length > 0,
      cIdToken: value === this.csc,
      cHashQRCode: value && value.length === 32
    };

    return validations[key] ? '✅' : '❌';
  }

  // Corrige o QR Code
  fixQRCode() {
    console.log('\n🔧 CORRIGINDO QR CODE');
    console.log('='.repeat(50));

    if (!this.chNFe) {
      console.log('❌ Não é possível corrigir sem a chave NFe');
      return false;
    }

    // Extrair parâmetros necessários do envelope
    const params = this.extractParamsFromEnvelope();

    if (!params) {
      console.log('❌ Falha ao extrair parâmetros do envelope');
      return false;
    }

    // Construir string do QR Code
    const qrString = this.buildQRString(params);

    // Calcular hash correto (32 caracteres)
    const hash = this.calculateQRHash(qrString);
    params.cHashQRCode = hash;

    // Reconstruir string final
    const finalQRString = this.buildQRString(params);

    console.log(`🔢 Hash calculado: ${hash}`);
    console.log(`📱 QR Code corrigido: ${finalQRString.substring(0, 100)}...`);

    // Substituir no envelope
    const oldQRMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (oldQRMatch) {
      const newQRTag = `<qrCode><![CDATA[${finalQRString}]]></qrCode>`;
      this.envelope = this.envelope.replace(oldQRMatch[0], newQRTag);
      console.log('✅ QR Code substituído no envelope');
      return true;
    }

    return false;
  }

  // Extrai parâmetros necessários do envelope
  extractParamsFromEnvelope() {
    const params = {};

    // Chave NFe
    params.chNFe = this.chNFe;

    // Versão
    params.nVersao = '100';

    // Ambiente (homologação)
    params.tpAmb = '2';

    // CPF do destinatário
    const cpfMatch = this.envelope.match(/<CPF>([0-9]{11})<\/CPF>/);
    params.cDest = cpfMatch ? cpfMatch[1] : null;

    // Data de emissão
    const dhEmiMatch = this.envelope.match(/<dhEmi>([^<]+)<\/dhEmi>/);
    if (dhEmiMatch) {
      // Converter para formato do QR Code
      const date = new Date(dhEmiMatch[1]);
      params.dhEmi = date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '') + '-0400';
    }

    // Valor total
    const vNFMatch = this.envelope.match(/<vNF>([\d.]+)<\/vNF>/);
    params.vNF = vNFMatch ? parseFloat(vNFMatch[1]).toFixed(2) : null;

    // ICMS (sempre 0.00 para NFC-e)
    params.vICMS = '0.00';

    // Digest value da assinatura
    const digestMatch = this.envelope.match(/<DigestValue>([^<]+)<\/DigestValue>/);
    params.digVal = digestMatch ? digestMatch[1] : null;

    // CSC
    params.cIdToken = this.csc;

    console.log('📋 Parâmetros extraídos:', params);
    return params;
  }

  // Constrói string do QR Code
  buildQRString(params) {
    return [
      `chNFe=${params.chNFe}`,
      `nVersao=${params.nVersao}`,
      `tpAmb=${params.tpAmb}`,
      `cDest=${params.cDest}`,
      `dhEmi=${params.dhEmi}`,
      `vNF=${params.vNF}`,
      `vICMS=${params.vICMS}`,
      `digVal=${params.digVal}`,
      `cIdToken=${params.cIdToken}`,
      `cHashQRCode=${params.cHashQRCode || ''}`
    ].join('&');
  }

  // Calcula hash do QR Code (SHA-256, primeiros 32 caracteres)
  calculateQRHash(qrString) {
    const hash = crypto.createHash('sha256');
    hash.update(qrString + this.cscToken);
    return hash.digest('hex').substring(0, 32).toUpperCase();
  }

  // Salva envelope corrigido
  saveFixedEnvelope(filename) {
    if (!this.envelope) {
      console.log('❌ Nenhum envelope para salvar');
      return false;
    }

    try {
      fs.writeFileSync(filename, this.envelope, 'utf8');
      console.log(`💾 Envelope corrigido salvo em: ${filename}`);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao salvar: ${error.message}`);
      return false;
    }
  }

  // Executa correção completa
  runFix() {
    console.log('🚀 INICIANDO CORREÇÃO DO QR CODE NFC-E');
    console.log('='.repeat(60));

    try {
      const currentParams = this.testCurrentQRCode();

      if (!currentParams) {
        console.log('❌ Não foi possível analisar o QR Code atual');
        return false;
      }

      const fixed = this.fixQRCode();

      if (fixed) {
        console.log('\n🔍 TESTANDO QR CODE CORRIGIDO');
        console.log('='.repeat(50));
        this.testCurrentQRCode();

        console.log('\n✅ CORREÇÃO CONCLUÍDA!');
        console.log('💡 Problemas corrigidos:');
        console.log('   - Adicionado parâmetro chNFe faltante');
        console.log('   - Corrigido tamanho do cHashQRCode (32 caracteres)');
        console.log('   - Recalculado hash com CSC correto');

        return true;
      }

    } catch (error) {
      console.log(`❌ Erro durante correção: ${error.message}`);
      return false;
    }

    return false;
  }
}

// Função principal
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📖 Uso: node qr-fixer.js <arquivo.xml>');
    console.log('');
    console.log('Exemplos:');
    console.log('  node qr-fixer.js envelope-exemplo.xml');
    console.log('');
    console.log('O script irá:');
    console.log('  1. Analisar o QR Code atual');
    console.log('  2. Identificar problemas (chNFe faltante, hash incorreto)');
    console.log('  3. Corrigir automaticamente');
    console.log('  4. Salvar envelope corrigido');
    return;
  }

  const fixer = new QRCodeFixer();

  try {
    fixer.loadEnvelope(args[0]);
    const success = fixer.runFix();

    if (success) {
      const outputFile = args[0].replace('.xml', '-corrigido.xml');
      fixer.saveFixedEnvelope(outputFile);
    }

  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
}

// Exportar para uso como módulo
module.exports = QRCodeFixer;

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
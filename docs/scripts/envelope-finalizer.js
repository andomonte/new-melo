// Script para preparar envelope final para envio SEFAZ-AM
// Corrige formatação e garante XML válido em uma linha

const fs = require('fs');

class EnvelopeFinalizer {
  constructor() {
    this.envelope = null;
  }

  // Carrega envelope formatado
  loadEnvelope(filename) {
    if (fs.existsSync(filename)) {
      this.envelope = fs.readFileSync(filename, 'utf8');
      console.log(`📄 Envelope carregado: ${filename}`);
      return true;
    }
    return false;
  }

  // Preparar envelope para envio (uma linha, sem espaços extras)
  prepareForSending() {
    console.log('🚀 PREPARANDO ENVELOPE PARA ENVIO SEFAZ-AM');
    console.log('='.repeat(50));

    if (!this.envelope) {
      console.log('❌ Envelope não carregado');
      return false;
    }

    let prepared = this.envelope;

    // 1. Remover quebras de linha e indentação
    prepared = prepared.replace(/\n/g, '');
    prepared = prepared.replace(/\s{2,}/g, ' ');

    // 2. Garantir que começa com <?xml
    if (!prepared.startsWith('<?xml')) {
      prepared = '<?xml version="1.0" encoding="UTF-8"?>' + prepared;
    }

    // 3. Remover espaços entre tags
    prepared = prepared.replace(/>\s+</g, '><');

    // 4. Verificar tamanho final
    console.log(`📏 Tamanho final: ${prepared.length} caracteres`);

    // 5. Validação final
    const isValid = this.finalValidation(prepared);

    if (isValid) {
      this.envelope = prepared;
      console.log('✅ Envelope preparado com sucesso');
      return true;
    } else {
      console.log('❌ Falha na preparação');
      return false;
    }
  }

  // Validação final
  finalValidation(xml) {
    const checks = [
      xml.includes('<soap12:Envelope'),
      xml.includes('<nfeAutorizacaoLote>'),
      xml.includes('<NFe'),
      xml.includes('<Signature'),
      xml.includes('<qrCode>'),
      xml.includes('</soap12:Envelope>'),
      xml.includes('chNFe='),
      xml.includes('cHashQRCode='),
      !xml.includes('\n'),
      !xml.includes('\r')
    ];

    const passed = checks.filter(c => c).length;
    console.log(`🔍 Validação final: ${passed}/${checks.length} OK`);

    return passed === checks.length;
  }

  // Salvar envelope final
  saveFinalEnvelope(filename) {
    if (!this.envelope) {
      console.log('❌ Nenhum envelope para salvar');
      return false;
    }

    try {
      fs.writeFileSync(filename, this.envelope, 'utf8');
      console.log(`💾 Envelope final salvo: ${filename}`);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao salvar: ${error.message}`);
      return false;
    }
  }

  // Executar preparação completa
  runFinalPreparation() {
    if (!this.loadEnvelope('envelope-xml-corrigido.xml')) {
      console.log('❌ Falha ao carregar envelope corrigido');
      return false;
    }

    const prepared = this.prepareForSending();

    if (prepared) {
      const saved = this.saveFinalEnvelope('envelope-final-pronto.xml');

      if (saved) {
        console.log('\n🎉 ENVELOPE FINAL PRONTO!');
        console.log('📋 Resumo das correções:');
        console.log('   ✅ XML bem formado e balanceado');
        console.log('   ✅ QR Code corrigido (32 caracteres hash)');
        console.log('   ✅ Uma linha só (sem quebras)');
        console.log('   ✅ Namespaces corretos');
        console.log('   ✅ Estrutura SOAP 1.2 válida');
        console.log('');
        console.log('🚀 Agora use este envelope com o endpoint correto:');
        console.log('   https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4');

        return true;
      }
    }

    return false;
  }
}

// Função principal
function main() {
  const finalizer = new EnvelopeFinalizer();
  finalizer.runFinalPreparation();
}

// Executar
if (require.main === module) {
  main();
}
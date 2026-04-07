// Script para validar correção do envelope SOAP para NFC-e
// Verifica se a estrutura foi corrigida para modelo 65

const fs = require('fs');
const path = require('path');

class NFCEEnvelopeValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  // Validar se o código foi corrigido
  validateCodeChanges() {
    console.log('🔍 VALIDAÇÃO DA CORREÇÃO DO ENVELOPE NFC-E');
    console.log('===========================================');
    console.log('');

    const filePath = path.join(this.projectRoot, 'src', 'utils', 'enviarCupomParaSefaz.ts');

    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Verificações
      const hasCriadoEnvelopeNFCE = content.includes('criarEnvelopeSOAP_NFCE');
      const hasEnviNFe = content.includes('<enviNFe');
      const hasIndSinc = content.includes('<indSinc>');
      const hasNfeAutorizacaoLote = content.includes('<nfeAutorizacaoLote>');
      const hasIdLote = content.includes('idLote');

      console.log('📋 Verificações no código:');
      console.log(`✅ Função criarEnvelopeSOAP_NFCE: ${hasCriadoEnvelopeNFCE ? 'Presente' : 'Ausente'}`);
      console.log(`❌ Tag enviNFe removida: ${!hasEnviNFe ? '✅ OK' : '❌ Ainda presente'}`);
      console.log(`❌ Tag indSinc removida: ${!hasIndSinc ? '✅ OK' : '❌ Ainda presente'}`);
      console.log(`❌ Tag nfeAutorizacaoLote removida: ${!hasNfeAutorizacaoLote ? '✅ OK' : '❌ Ainda presente'}`);
      console.log(`❌ Referência idLote removida: ${!hasIdLote ? '✅ OK' : '❌ Ainda presente'}`);

      console.log('\n🔍 ESTRUTURA DO NOVO ENVELOPE:');
      console.log('='.repeat(35));

      // Verificar estrutura do envelope NFC-e
      const envelopeFunction = content.match(/function criarEnvelopeSOAP_NFCE[\s\S]*?return envelope;/);
      if (envelopeFunction) {
        const envelopeCode = envelopeFunction[0];
        console.log('✅ Envelope NFC-e encontrado:');

        const checks = [
          envelopeCode.includes('<soap12:Header>'),
          envelopeCode.includes('<nfeCabecMsg'),
          envelopeCode.includes('<cUF>13</cUF>'),
          envelopeCode.includes('<versaoDados>4.00</versaoDados>'),
          envelopeCode.includes('<nfeDadosMsg'),
          !envelopeCode.includes('<nfeAutorizacaoLote>'),
          !envelopeCode.includes('<enviNFe'),
          !envelopeCode.includes('<indSinc>')
        ];

        console.log(`   ✅ Header SOAP: ${checks[0] ? 'Presente' : 'Ausente'}`);
        console.log(`   ✅ nfeCabecMsg: ${checks[1] ? 'Presente' : 'Ausente'}`);
        console.log(`   ✅ cUF=13: ${checks[2] ? 'Presente' : 'Ausente'}`);
        console.log(`   ✅ versaoDados=4.00: ${checks[3] ? 'Presente' : 'Ausente'}`);
        console.log(`   ✅ nfeDadosMsg: ${checks[4] ? 'Presente' : 'Ausente'}`);
        console.log(`   ✅ nfeAutorizacaoLote removido: ${checks[5] ? '✅ OK' : '❌ Ainda presente'}`);
        console.log(`   ✅ enviNFe removido: ${checks[6] ? '✅ OK' : '❌ Ainda presente'}`);
        console.log(`   ✅ indSinc removido: ${checks[7] ? '✅ OK' : '❌ Ainda presente'}`);

        const allCorrect = checks.every(c => c);
        console.log(`\n🎯 RESULTADO: ${allCorrect ? '✅ ESTRUTURA CORRETA!' : '❌ PROBLEMAS ENCONTRADOS'}`);

        return allCorrect;
      } else {
        console.log('❌ Função criarEnvelopeSOAP_NFCE não encontrada');
        return false;
      }

    } catch (error) {
      console.log(`❌ Erro ao validar código: ${error.message}`);
      return false;
    }
  }

  // Comparar envelopes
  compareEnvelopes() {
    console.log('\n🔄 COMPARAÇÃO: ANTES vs DEPOIS');
    console.log('='.repeat(30));

    console.log('❌ ESTRUTURA ANTERIOR (NF-e):');
    console.log('   <soap12:Envelope>');
    console.log('     <soap12:Body>');
    console.log('       <nfeAutorizacaoLote>');
    console.log('         <nfeDadosMsg>');
    console.log('           <enviNFe versao="4.00" idLote="...">');
    console.log('             <indSinc>1</indSinc>');
    console.log('             <NFe>...</NFe>');
    console.log('           </enviNFe>');
    console.log('         </nfeDadosMsg>');
    console.log('       </nfeAutorizacaoLote>');
    console.log('     </soap12:Body>');
    console.log('   </soap12:Envelope>');

    console.log('\n✅ ESTRUTURA CORRIGIDA (NFC-e):');
    console.log('   <soap12:Envelope>');
    console.log('     <soap12:Header>');
    console.log('       <nfeCabecMsg>');
    console.log('         <cUF>13</cUF>');
    console.log('         <versaoDados>4.00</versaoDados>');
    console.log('       </nfeCabecMsg>');
    console.log('     </soap12:Header>');
    console.log('     <soap12:Body>');
    console.log('       <nfeDadosMsg>');
    console.log('         <NFe>...</NFe>  <!-- XML diretamente -->');
    console.log('       </nfeDadosMsg>');
    console.log('     </soap12:Body>');
    console.log('   </soap12:Envelope>');
  }

  // Executar validação completa
  runValidation() {
    const success = this.validateCodeChanges();
    this.compareEnvelopes();

    console.log('\n🎯 RESUMO DA VALIDAÇÃO:');
    console.log('='.repeat(25));

    if (success) {
      console.log('✅ CORREÇÃO APLICADA COM SUCESSO!');
      console.log('   - Estrutura alterada de NF-e para NFC-e');
      console.log('   - Elementos desnecessários removidos');
      console.log('   - Header SOAP adicionado');
      console.log('   - XML da NFC-e enviado diretamente');
      console.log('');
      console.log('🚀 PRONTO PARA TESTE REAL!');
      console.log('   O erro 215 deve ser resolvido.');
    } else {
      console.log('❌ CORREÇÃO INCOMPLETA');
      console.log('   Verificar implementação novamente');
    }

    return success;
  }
}

// Executar validação
async function main() {
  const validator = new NFCEEnvelopeValidator();
  validator.runValidation();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
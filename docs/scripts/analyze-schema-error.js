// Script para analisar erro 215 - Falha no schema XML
// Identifica problemas na estrutura do envelope SOAP para NFC-e

const fs = require('fs');
const path = require('path');

class NFCEEnvelopeAnalyzer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  // Analisar envelope SOAP enviado
  analyzeEnvelope() {
    console.log('🔍 ANÁLISE DO ERRO 215 - FALHA NO SCHEMA XML');
    console.log('===============================================');
    console.log('');

    // Ler o envelope salvo
    const envelopePath = path.join(this.projectRoot, 'scripts', 'envelope-soap-nfce.xml');
    let envelopeContent = '';

    try {
      envelopeContent = fs.readFileSync(envelopePath, 'utf8');
      console.log('📄 Envelope SOAP lido com sucesso');
    } catch (error) {
      console.log(`❌ Erro ao ler envelope: ${error.message}`);
      return;
    }

    console.log('\n🔍 ANÁLISE ESTRUTURAL:');
    console.log('='.repeat(30));

    // Verificar estrutura básica
    const hasDeclaration = envelopeContent.includes('<?xml version="1.0"');
    const hasNFe = envelopeContent.includes('<NFe');
    const hasInfNFe = envelopeContent.includes('<infNFe');
    const hasSignature = envelopeContent.includes('<Signature');
    const hasInfNFeSupl = envelopeContent.includes('<infNFeSupl');

    console.log(`✅ Declaração XML: ${hasDeclaration ? 'Presente' : 'Ausente'}`);
    console.log(`✅ Tag NFe: ${hasNFe ? 'Presente' : 'Ausente'}`);
    console.log(`✅ Tag infNFe: ${hasInfNFe ? 'Presente' : 'Ausente'}`);
    console.log(`✅ Assinatura: ${hasSignature ? 'Presente' : 'Ausente'}`);
    console.log(`✅ infNFeSupl (QR Code): ${hasInfNFeSupl ? 'Presente' : 'Ausente'}`);

    console.log('\n🔍 VERIFICAÇÃO DE NAMESPACES:');
    console.log('='.repeat(30));

    // Verificar namespaces
    const nfeNamespace = envelopeContent.match(/<NFe[^>]*xmlns="([^"]*)"/);
    const infNFeVersao = envelopeContent.match(/<infNFe[^>]*versao="([^"]*)"/);

    console.log(`📋 Namespace NFe: ${nfeNamespace ? nfeNamespace[1] : 'Não encontrado'}`);
    console.log(`📋 Versão infNFe: ${infNFeVersao ? infNFeVersao[1] : 'Não encontrada'}`);

    console.log('\n🔍 ANÁLISE DO ENVELOPE SOAP ENVIADO:');
    console.log('='.repeat(40));

    // O envelope enviado foi diferente do arquivo salvo
    // Vamos analisar baseado no log do usuário
    console.log('📤 Envelope SOAP enviado (do log):');
    console.log('   <nfeAutorizacaoLote>');
    console.log('     <nfeDadosMsg>');
    console.log('       <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">');
    console.log('         <indSinc>1</indSinc>');
    console.log('         <NFe xmlns="http://www.portalfiscal.inf.br/nfe">');
    console.log('           <!-- XML NFC-e -->');
    console.log('         </NFe>');
    console.log('       </enviNFe>');
    console.log('     </nfeDadosMsg>');
    console.log('   </nfeAutorizacaoLote>');

    console.log('\n⚠️  POSSÍVEIS PROBLEMAS IDENTIFICADOS:');
    console.log('='.repeat(40));

    console.log('1. 📋 ESTRUTURA INCORRETA PARA NFC-E:');
    console.log('   - O envelope usa <enviNFe> e <indSinc> (estrutura de NF-e)');
    console.log('   - Para NFC-e, deve ser apenas o XML da NFC-e diretamente');

    console.log('\n2. 🔗 NAMESPACE DUPLICADO:');
    console.log('   - <enviNFe> declara xmlns="http://www.portalfiscal.inf.br/nfe"');
    console.log('   - <NFe> declara o mesmo namespace novamente');

    console.log('\n3. 📊 ELEMENTOS DESNECESSÁRIOS:');
    console.log('   - <indSinc>1</indSinc> pode não ser necessário para NFC-e');
    console.log('   - <enviNFe> pode não ser necessário para NFC-e');

    console.log('\n💡 SOLUÇÃO SUGERIDA:');
    console.log('='.repeat(20));

    console.log('Para NFC-e (modelo 65), o envelope SOAP deve conter apenas:');
    console.log('');
    console.log('<soap12:Envelope ...>');
    console.log('  <soap12:Body>');
    console.log('    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">');
    console.log('      <!-- XML da NFC-e diretamente aqui -->');
    console.log('    </nfeDadosMsg>');
    console.log('  </soap12:Body>');
    console.log('</soap12:Envelope>');

    console.log('\n🔧 PRÓXIMOS PASSOS:');
    console.log('1. Modificar envelope para remover <enviNFe> e <indSinc>');
    console.log('2. Colocar XML da NFC-e diretamente em <nfeDadosMsg>');
    console.log('3. Testar novamente com SEFAZ-AM');
  }

  // Gerar envelope corrigido
  generateCorrectedEnvelope() {
    console.log('\n🔧 GERANDO ENVELOPE CORRIGIDO:');
    console.log('='.repeat(30));

    const envelopePath = path.join(this.projectRoot, 'scripts', 'envelope-soap-nfce.xml');

    try {
      const nfeContent = fs.readFileSync(envelopePath, 'utf8');

      // Envelope corrigido para NFC-e
      const correctedEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>13</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${nfeContent}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

      // Salvar envelope corrigido
      const correctedPath = path.join(this.projectRoot, 'scripts', 'envelope-soap-nfce-corrected.xml');
      fs.writeFileSync(correctedPath, correctedEnvelope, 'utf8');

      console.log('✅ Envelope corrigido salvo em:');
      console.log(`   ${correctedPath}`);
      console.log(`📏 Tamanho: ${correctedEnvelope.length} caracteres`);

      return correctedEnvelope;

    } catch (error) {
      console.log(`❌ Erro ao gerar envelope corrigido: ${error.message}`);
      return null;
    }
  }

  // Executar análise completa
  runAnalysis() {
    this.analyzeEnvelope();
    this.generateCorrectedEnvelope();

    console.log('\n🎯 RESUMO DA ANÁLISE:');
    console.log('='.repeat(25));
    console.log('📋 Problema: Estrutura do envelope SOAP incorreta para NFC-e');
    console.log('🔧 Solução: Remover <enviNFe> e <indSinc>, usar XML direto');
    console.log('📄 Arquivo corrigido gerado para referência');
  }
}

// Executar análise
async function main() {
  const analyzer = new NFCEEnvelopeAnalyzer();
  analyzer.runAnalysis();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}
// Investigação específica: estrutura do envelope enviNFe para NFC-e
console.log('🔍 INVESTIGAÇÃO: ESTRUTURA ENVELOPE enviNFe PARA NFC-e');
console.log('===================================================\n');

console.log('📋 PROBLEMA ATUAL:');
console.log('- XML estruturalmente correto');
console.log('- Todas as correções aplicadas');
console.log('- Ainda erro 215 (Falha no schema XML)');
console.log('- Suspeita: problema no envelope enviNFe');

console.log('\n🔍 ANÁLISE DO ENVELOPE ATUAL:');
const envelopeAtual = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>1760732410837</idLote>
  <indSinc>1</indSinc>
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe13251018053139000169650020017018751250112031">`;

console.log('\n❌ PROBLEMAS IDENTIFICADOS NO ENVELOPE:');

console.log('\n1️⃣ PROBLEMA: QUEBRA DE LINHA APÓS <NFe>');
console.log('   ATUAL: <NFe xmlns="...">');
console.log('          <infNFe versao="..." Id="...">');
console.log('   CORRETO: <NFe xmlns="..."><infNFe versao="..." Id="...">');

console.log('\n2️⃣ PROBLEMA: INDENTAÇÃO INCONSISTENTE');
console.log('   XML pode ter espaços/tabs que violam schema');

console.log('\n3️⃣ PROBLEMA: VERSÃO DO ENVELOPE');
console.log('   Verificar se versao="4.00" está correto para NFC-e');

console.log('\n4️⃣ PROBLEMA: NAMESPACE DUPLICADO');
console.log('   enviNFe e NFe ambos com mesmo namespace');

console.log('\n💡 SOLUÇÕES PROPOSTAS:');

console.log('\n🔧 SOLUÇÃO 1: COMPACTAR XML (SEM QUEBRAS DE LINHA)');
console.log('   Gerar XML em linha única, sem formatação');

console.log('\n🔧 SOLUÇÃO 2: NAMESPACE ÚNICO');
console.log('   Remover namespace da NFe interna (manter só no enviNFe)');

console.log('\n🔧 SOLUÇÃO 3: VERIFICAR MANUAL SEFAZ-AM');
console.log('   Consultar documentação específica NFC-e Amazonas');

console.log('\n🔧 SOLUÇÃO 4: TESTAR SEM ENVELOPE');
console.log('   Enviar apenas <NFe> sem <enviNFe> (para debug)');

console.log('\n🎯 PLANO DE AÇÃO IMEDIATO:');
console.log('==========================');

console.log('1. 📝 Modificar geração para XML compacto (sem quebras)');
console.log('2. 🧪 Testar com namespace único');
console.log('3. 🔄 Se persistir: testar XML de exemplo do manual');
console.log('4. 📞 Se tudo falhar: consultar suporte SEFAZ-AM');

console.log('\n⚠️  CONSIDERAÇÃO IMPORTANTE:');
console.log('===============================');
console.log('Erro 215 persistente após 6+ tentativas indica:');
console.log('- Problema fundamental na estrutura');
console.log('- Ou diferença específica da SEFAZ-AM');
console.log('- Ou versão incorreta do schema');

console.log('\n✅ Próximo passo: Implementar XML compacto');

return {
  acoes: [
    'Gerar XML sem formatação (compacto)',
    'Testar namespace único no envelope',
    'Consultar manual SEFAZ-AM específico',
    'Considerar contato com suporte técnico'
  ]
};
const fs = require('fs');

// Análise FINAL para erro 215 - verificando problemas sutis
function analiseFinalErro215() {
  console.log('🔬 ANÁLISE FINAL - ERRO 215 PERSISTENTE');
  console.log('=====================================\n');

  console.log('✅ PROGRESSOS JÁ CONQUISTADOS:');
  console.log('1. ✅ Namespace NFe adicionado');
  console.log('2. ✅ PIS/COFINS zerados (era 0.72/3.31, agora 0.00)');
  console.log('3. ✅ IPI zerado');
  console.log('4. ✅ CST 07 para PIS/COFINS');
  console.log('5. ✅ Campo infCpl removido');
  console.log('6. ✅ QR-Code com hash real funcionando');
  console.log('7. ✅ Chave de acesso válida (44 dígitos)');

  console.log('\n🔍 INVESTIGAÇÃO DE PROBLEMAS SUTIS:');
  console.log('==================================\n');

  console.log('🕵️  SUSPEITA 1: PROBLEMA NO CAMPO <cEAN> e <cEANTrib>');
  console.log('   XML atual: <cEAN>SEM GTIN</cEAN>');
  console.log('   XML atual: <cEANTrib>SEM GTIN</cEANTrib>');
  console.log('   ⚠️  POSSÍVEL PROBLEMA: Alguns validadores exigem vazio ao invés de "SEM GTIN"');
  console.log('   💡 TESTE: Trocar para <cEAN/> e <cEANTrib/>');

  console.log('\n🕵️  SUSPEITA 2: CAMPO <NCM> INVÁLIDO');
  console.log('   XML atual: <NCM>87089990</NCM>');
  console.log('   ⚠️  POSSÍVEL PROBLEMA: NCM pode estar inválido na tabela SEFAZ');
  console.log('   💡 TESTE: Usar NCM genérico válido como 84714900');

  console.log('\n🕵️  SUSPEITA 3: VALOR DECIMAL COM PRECISÃO');
  console.log('   XML atual: <vUnCom>4.36</vUnCom> e <vUnTrib>4.36</vUnTrib>');
  console.log('   ⚠️  POSSÍVEL PROBLEMA: Valores unitários podem precisar de mais decimais');
  console.log('   💡 TESTE: Usar 4 casas decimais: 4.3600');

  console.log('\n🕵️  SUSPEITA 4: QUANTIDADE SEM DECIMAIS');
  console.log('   XML atual: <qCom>10</qCom> e <qTrib>10</qTrib>');
  console.log('   ⚠️  POSSÍVEL PROBLEMA: Quantidade pode precisar de decimais');
  console.log('   💡 TESTE: Usar 4 casas decimais: 10.0000');

  console.log('\n🕵️  SUSPEITA 5: CAMPO <xProd> COM TEXTO DE HOMOLOGAÇÃO');
  console.log('   XML atual: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"');
  console.log('   ⚠️  POSSÍVEL PROBLEMA: Texto muito longo ou caracteres especiais');
  console.log('   💡 TESTE: Simplificar para "PRODUTO TESTE HOMOLOGACAO"');

  console.log('\n🎯 PLANO DE CORREÇÃO IMEDIATA:');
  console.log('=============================');
  
  console.log('🔧 CORREÇÃO 1: Campos EAN vazios');
  console.log('   De: <cEAN>SEM GTIN</cEAN>');
  console.log('   Para: <cEAN></cEAN>');
  
  console.log('\n🔧 CORREÇÃO 2: NCM válido');
  console.log('   De: <NCM>87089990</NCM>');
  console.log('   Para: <NCM>84714900</NCM> (equipamentos informática)');
  
  console.log('\n🔧 CORREÇÃO 3: Valores com 4 decimais');
  console.log('   De: <qCom>10</qCom>');
  console.log('   Para: <qCom>10.0000</qCom>');
  console.log('   De: <vUnCom>4.36</vUnCom>');
  console.log('   Para: <vUnCom>4.3600</vUnCom>');

  console.log('\n🔧 CORREÇÃO 4: Descrição simplificada');
  console.log('   De: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"');
  console.log('   Para: "PRODUTO TESTE HOMOLOGACAO"');

  console.log('\n📊 ESTATÍSTICAS DO PROBLEMA:');
  console.log('============================');
  console.log('❌ Tentativas com erro 215: 4+');
  console.log('⏱️  Tempo gasto: 2+ horas');
  console.log('🎯 Foco atual: Campos específicos que violam XSD');

  console.log('\n🚀 PRÓXIMA AÇÃO:');
  console.log('================');
  console.log('Aplicar as 4 correções acima simultaneamente');
  console.log('Se ainda der 215, partir para XML minimalista de teste');

  return {
    correcoesPrioritarias: [
      'EAN campos vazios ao invés de "SEM GTIN"',
      'NCM válido (84714900)',
      'Quantidade com 4 decimais (10.0000)',
      'Valores unitários com 4 decimais (4.3600)',
      'Descrição produto simplificada'
    ]
  };
}

// Executar análise
try {
  const resultado = analiseFinalErro215();
  console.log('\n✅ Análise final concluída!');
  console.log('🎯 Correções prioritárias:', resultado.correcoesPrioritarias.length);
} catch (error) {
  console.error('❌ Erro na análise:', error.message);
}
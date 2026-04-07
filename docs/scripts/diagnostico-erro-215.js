const fs = require('fs');

// Função para testar problemas específicos de schema NFCe
function diagnosticarProblemaSchema() {
  console.log('🔬 DIAGNÓSTICO ESPECÍFICO PARA ERRO 215 - NFCE');
  console.log('===============================================\n');

  // Problemas conhecidos que causam erro 215 em NFC-e:
  
  console.log('1️⃣ PROBLEMA: CAMPOS DECIMAIS E FORMATAÇÃO');
  console.log('==========================================');
  console.log('❌ Campos com vírgula ao invés de ponto');
  console.log('❌ Campos com mais de 2 casas decimais em valores monetários');
  console.log('❌ Campos numéricos com zeros à esquerda inválidos');
  console.log('❌ Campos vazios ou com espaços em branco');
  
  console.log('\n2️⃣ PROBLEMA: CARACTERES ESPECIAIS');
  console.log('=================================');
  console.log('❌ Acentos em campos que não permitem');
  console.log('❌ Caracteres de controle invisíveis');
  console.log('❌ Encoding UTF-8 incorreto');
  
  console.log('\n3️⃣ PROBLEMA: ORDEM DOS ELEMENTOS');
  console.log('================================');
  console.log('❌ infNFeSupl deve vir APÓS a assinatura');
  console.log('❌ Elementos dentro de <ide> fora de ordem');
  console.log('❌ Elementos dentro de <total> fora de ordem');
  
  console.log('\n4️⃣ PROBLEMA: CAMPOS ESPECÍFICOS NFCE');
  console.log('====================================');
  console.log('❌ indPres=1 mas não é venda presencial');
  console.log('❌ tpImp=4 (DANFE NFC-e) obrigatório para modelo 65');
  console.log('❌ indFinal=1 obrigatório para NFC-e');
  console.log('❌ Falta de campos obrigatórios para Simples Nacional');
  
  console.log('\n5️⃣ SUSPEITA PRINCIPAL: FORMATAÇÃO DE VALORES');
  console.log('============================================');
  console.log('🔍 Vamos verificar os valores do XML que foi enviado:');
  
  // Valores que estavam no XML
  const valores = {
    vProd: '43.60',
    vNF: '43.60',
    vPag: '43.60',
    vUnCom: '4.36',
    vUnTrib: '4.36',
    qCom: '10',
    qTrib: '10',
    vBC: '0.00',
    vICMS: '0.00',
    vPIS: '0.72',
    vCOFINS: '3.31'
  };
  
  console.log('📊 ANÁLISE DOS VALORES:');
  Object.entries(valores).forEach(([campo, valor]) => {
    const temPonto = valor.includes('.');
    const casasDecimais = temPonto ? valor.split('.')[1].length : 0;
    const ehNumerico = !isNaN(parseFloat(valor));
    
    console.log(`   ${campo}: ${valor}`);
    console.log(`     ${ehNumerico ? '✅' : '❌'} Numérico: ${ehNumerico}`);
    console.log(`     ${temPonto ? '✅' : '❌'} Tem ponto decimal: ${temPonto}`);
    console.log(`     ${casasDecimais <= 4 ? '✅' : '❌'} Casas decimais: ${casasDecimais} ${casasDecimais <= 4 ? '(OK)' : '(ERRO: máx 4)'}`);
    console.log('');
  });
  
  console.log('\n6️⃣ SUSPEITA: PROBLEMAS NO CÁLCULO DE IMPOSTOS');
  console.log('=============================================');
  console.log('🧮 Verificando consistência dos valores:');
  
  const vProdTotal = parseFloat(valores.vProd);
  const vNFTotal = parseFloat(valores.vNF);
  const vPagTotal = parseFloat(valores.vPag);
  
  console.log(`   vProd (produtos): R$ ${vProdTotal.toFixed(2)}`);
  console.log(`   vNF (nota fiscal): R$ ${vNFTotal.toFixed(2)}`);
  console.log(`   vPag (pagamento): R$ ${vPagTotal.toFixed(2)}`);
  
  const valoresIguais = vProdTotal === vNFTotal && vNFTotal === vPagTotal;
  console.log(`   ${valoresIguais ? '✅' : '❌'} Valores consistentes: ${valoresIguais}`);
  
  console.log('\n7️⃣ SUSPEITA: PIS/COFINS PARA SIMPLES NACIONAL');
  console.log('===========================================');
  console.log('⚠️  PROBLEMA IDENTIFICADO:');
  console.log('   O XML mostra CRT=1 (Simples Nacional)');
  console.log('   Mas está calculando PIS (0.72) e COFINS (3.31)');
  console.log('   No Simples Nacional, PIS/COFINS devem ser CST=99 (sem valor)');
  console.log('   Ou não deve haver cálculo de PIS/COFINS separado');
  
  console.log('\n8️⃣ SUSPEITA: CAMPO infCpl VAZIO');
  console.log('==============================');
  console.log('⚠️  XML mostra: <infCpl>.</infCpl>');
  console.log('   Campo com apenas "." pode causar problema de schema');
  console.log('   Deve ser texto válido ou tag omitida completamente');
  
  console.log('\n9️⃣ CORREÇÕES PRIORITÁRIAS:');
  console.log('=========================');
  console.log('🔧 1. Corrigir PIS/COFINS para Simples Nacional (CST=99)');
  console.log('🔧 2. Corrigir campo infCpl (remover ou preencher adequadamente)');
  console.log('🔧 3. Verificar se todos os campos decimais estão com formato correto');
  console.log('🔧 4. Verificar ordem exata dos elementos XML');
  console.log('🔧 5. Verificar encoding UTF-8 sem BOM');
  
  console.log('\n🎯 PLANO DE AÇÃO:');
  console.log('================');
  console.log('1. Corrigir cálculos de PIS/COFINS para Simples Nacional');
  console.log('2. Corrigir campo infCpl');
  console.log('3. Testar novamente');
  console.log('4. Se persistir, criar XML mínimo para teste');
  
  return {
    problemasIdentificados: [
      'PIS/COFINS calculado incorretamente para Simples Nacional',
      'Campo infCpl com valor inadequado (.)',
      'Possível problema de encoding ou ordem de elementos'
    ]
  };
}

// Executar diagnóstico
try {
  const resultado = diagnosticarProblemaSchema();
  console.log('\n✅ Diagnóstico concluído!');
  console.log('📋 Principais problemas:', resultado.problemasIdentificados);
} catch (error) {
  console.error('❌ Erro no diagnóstico:', error.message);
}
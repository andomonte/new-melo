const fs = require('fs');

// Análise profunda do XML real enviado para SEFAZ
function analisarXMLReal() {
  console.log('🔬 ANÁLISE PROFUNDA DO XML REAL - ERRO 215 PERSISTENTE');
  console.log('====================================================\n');

  // XML exato que foi enviado (baseado no log)
  const xmlReal = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>1760731422574</idLote>
  <indSinc>1</indSinc>
  <NFe>
  <infNFe versao="4.00" Id="NFe13251018053139000169650020017018731391871139">
    <ide>
      <cUF>13</cUF>
      <cNF>39187113</cNF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>2</serie>
      <nNF>1701873</nNF>
      <dhEmi>2025-10-17T16:03:42-04:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>1302603</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>9</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
  </infNFe>
</NFe>
</enviNFe>`;

  console.log('🔍 PROBLEMAS POTENCIAIS IDENTIFICADOS:');
  console.log('=====================================\n');

  // 1. Verificar quebras de linha e formatação
  console.log('1️⃣ ESTRUTURA DE TAGS:');
  const linhas = xmlReal.split('\n');
  linhas.forEach((linha, i) => {
    const trimmed = linha.trim();
    if (trimmed) {
      // Verificar se a linha tem abertura e fechamento correto
      const temAbertura = trimmed.includes('<') && !trimmed.includes('</');
      const temFechamento = trimmed.includes('</');
      const temAutoFechamento = trimmed.includes('/>');
      const temTexto = trimmed.includes('>') && trimmed.includes('<') && !trimmed.startsWith('<');
      
      if (trimmed.includes('<NFe>') || trimmed.includes('<infNFe')) {
        console.log(`   Linha ${i+1}: ${trimmed}`);
        console.log(`     ⚠️  SUSPEITA: Tag em linha separada pode estar causando problema`);
      }
    }
  });

  console.log('\n2️⃣ PROBLEMAS ESPECÍFICOS IDENTIFICADOS:');
  console.log('=======================================');

  // Problema 1: NFe e infNFe em linhas separadas
  if (xmlReal.includes('<NFe>\n  <infNFe')) {
    console.log('❌ PROBLEMA 1: <NFe> e <infNFe> estão em linhas separadas');
    console.log('   SEFAZ espera: <NFe><infNFe versao="4.00" Id="...">');
    console.log('   Mas temos: <NFe>\\n  <infNFe versao="4.00" Id="...">');
  }

  // Problema 2: Indentação pode estar causando problemas
  if (xmlReal.includes('  <NFe>')) {
    console.log('❌ PROBLEMA 2: Indentação excessiva no XML');
    console.log('   XML enviNFe pode precisar ser mais compacto');
  }

  // Problema 3: Verificar espaçamentos nos valores
  const valores = xmlReal.match(/<[^>]+>([^<]+)<\/[^>]+>/g) || [];
  console.log('\n3️⃣ VALORES DOS CAMPOS:');
  valores.slice(0, 10).forEach(match => {
    const valor = match.replace(/<[^>]+>/g, '');
    if (valor.includes(' ') && !valor.includes('LEAO DE JUDA')) {
      console.log(`❌ Valor com espaços: "${valor}"`);
    }
  });

  console.log('\n4️⃣ NAMESPACE E ENCODING:');
  console.log('========================');
  
  // Verificar namespace
  if (xmlReal.includes('xmlns="http://www.portalfiscal.inf.br/nfe"')) {
    console.log('✅ Namespace correto');
  } else {
    console.log('❌ Namespace incorreto ou ausente');
  }

  // Verificar versão
  if (xmlReal.includes('versao="4.00"')) {
    console.log('✅ Versão 4.00 correta');
  } else {
    console.log('❌ Versão incorreta');
  }

  console.log('\n5️⃣ HIPÓTESES PARA O ERRO 215 PERSISTENTE:');
  console.log('=========================================');
  
  console.log('🔍 HIPÓTESE 1: Formatação do XML');
  console.log('   - Quebras de linha inadequadas');
  console.log('   - Indentação incompatível com schema');
  console.log('   - <NFe> e <infNFe> em linhas separadas');
  
  console.log('\n🔍 HIPÓTESE 2: Campo específico faltando');
  console.log('   - XML pode estar faltando algum campo obrigatório');
  console.log('   - Ou algum campo tem formato incompatível');
  
  console.log('\n🔍 HIPÓTESE 3: Problema no envelope enviNFe');
  console.log('   - indSinc pode precisar estar em formato específico');
  console.log('   - idLote pode ter restrições de formato');
  
  console.log('\n🔍 HIPÓTESE 4: Encoding/Character Set');
  console.log('   - Pode ser problema de UTF-8 vs outros encodings');
  console.log('   - Caracteres invisíveis no XML');

  console.log('\n6️⃣ PLANO DE CORREÇÃO:');
  console.log('====================');
  
  console.log('🔧 TESTE 1: Compactar XML (remover quebras de linha)');
  console.log('🔧 TESTE 2: Verificar se infNFe deve estar junto com NFe');
  console.log('🔧 TESTE 3: Testar com XML minimalista');
  console.log('🔧 TESTE 4: Comparar com XML de exemplo do manual da SEFAZ');

  console.log('\n🎯 PRÓXIMA AÇÃO:');
  console.log('================');
  console.log('Vamos modificar a geração do XML para ser mais compacta');
  console.log('e seguir exatamente o padrão esperado pela SEFAZ');

  return {
    problemasIdentificados: [
      'XML com formatação inadequada',
      'Quebras de linha podem estar causando erro de schema',
      'Estrutura de tags pode não estar seguindo padrão exato do XSD'
    ]
  };
}

// Executar análise
try {
  const resultado = analisarXMLReal();
  console.log('\n✅ Análise do XML real concluída!');
  console.log('📋 Problemas:', resultado.problemasIdentificados);
} catch (error) {
  console.error('❌ Erro na análise:', error.message);
}
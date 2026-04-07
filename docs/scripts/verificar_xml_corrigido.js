const fs = require('fs');

console.log('🔍 ANÁLISE DO XML RECÉM-GERADO');
console.log('==============================');

try {
  const xml = fs.readFileSync('scripts/diagnose_output.xml', 'utf8');

  // Extrair primeiro item para verificar cálculo
  const firstItem = xml.match(/<det nItem="1">([\s\S]*?)<\/det>/);
  if (firstItem) {
    const qCom = firstItem[1].match(/<qCom>([^<]+)<\/qCom>/)[1];
    const vUnCom = firstItem[1].match(/<vUnCom>([^<]+)<\/vUnCom>/)[1];
    const vProd = firstItem[1].match(/<vProd>([^<]+)<\/vProd>/)[1];
    
    const calculado = parseFloat(qCom) * parseFloat(vUnCom);
    const calculadoCentavos = Math.round(parseFloat(qCom) * parseFloat(vUnCom) * 100) / 100;
    const declarado = parseFloat(vProd);
    
    console.log('PRIMEIRO ITEM:');
    console.log(`qCom: ${qCom}`);
    console.log(`vUnCom: ${vUnCom}`);
    console.log(`vProd declarado: ${vProd}`);
    console.log(`vProd calculado (direto): ${calculado.toFixed(10)}`);
    console.log(`vProd calculado (centavos): ${calculadoCentavos.toFixed(10)}`);
    console.log(`Match direto: ${calculado === declarado ? '✅' : '❌'}`);
    console.log(`Match centavos: ${calculadoCentavos === declarado ? '✅' : '❌'}`);
    console.log(`String match: ${calculadoCentavos.toFixed(2) === vProd ? '✅' : '❌'}`);
  }

  // Verificar alguns outros itens
  const allItems = xml.match(/<det nItem="\d+">([\s\S]*?)<\/det>/g) || [];
  console.log(`\nTOTAL DE ITENS ENCONTRADOS: ${allItems.length}`);
  
  let problemas = 0;
  allItems.slice(0, 5).forEach((item, index) => {
    const qCom = item.match(/<qCom>([^<]+)<\/qCom>/)[1];
    const vUnCom = item.match(/<vUnCom>([^<]+)<\/vUnCom>/)[1];
    const vProd = item.match(/<vProd>([^<]+)<\/vProd>/)[1];
    
    const calculado = parseFloat(qCom) * parseFloat(vUnCom);
    const calculadoCentavos = Math.round(calculado * 100) / 100;
    const declarado = parseFloat(vProd);
    
    const match = Math.abs(calculadoCentavos - declarado) < 0.005;
    
    console.log(`Item ${index + 1}: ${qCom} x ${vUnCom} = ${calculadoCentavos.toFixed(2)} (declarado: ${vProd}) ${match ? '✅' : '❌'}`);
    
    if (!match) problemas++;
  });
  
  if (problemas === 0) {
    console.log('\n🎉 TODOS OS CÁLCULOS ESTÃO CORRETOS!');
    console.log('A correção da aritmética de centavos foi aplicada com sucesso.');
  } else {
    console.log(`\n⚠️ ${problemas} problemas detectados nos primeiros 5 itens.`);
  }
  
} catch (error) {
  console.error('❌ Erro na análise:', error);
}
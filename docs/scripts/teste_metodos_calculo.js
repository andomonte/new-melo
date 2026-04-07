// Script para demonstrar a diferença entre métodos de cálculo
const valores = {
  vProd: 11968.60,
  vFrete: 0.00,
  vSeg: 0.00,
  vDesc: 0.00,
  vII: 0.00,
  vIPI: 1176.94,
  vIPIDevol: 0.00,
  vPIS: 216.36,
  vCOFINS: 1018.36,
  vICMS: 2393.76,
  vICMSST: 0.00,
  vFCP: 0.00,
  vFCPST: 0.00,
  vFCPSTRet: 0.00,
  vFCPUFDest: 0.00,
  vICMSUFDest: 0.00,
  vICMSUFRemet: 0.00,
  vOutro: 0.00
};

console.log('🧮 COMPARAÇÃO DE MÉTODOS DE CÁLCULO vNF');
console.log('==========================================');

// Método 1: Soma direta (problemático)
const metodo1 = valores.vProd + valores.vFrete + valores.vSeg + valores.vOutro - valores.vDesc + valores.vII + valores.vIPI + valores.vIPIDevol + valores.vPIS + valores.vCOFINS + valores.vICMS + valores.vICMSST + valores.vFCP + valores.vFCPST + valores.vFCPSTRet + valores.vFCPUFDest + valores.vICMSUFDest + valores.vICMSUFRemet;

// Método 2: Aritmética de centavos (correção SEFAZ AM)
const metodo2Centavos = Math.round(valores.vProd * 100) + Math.round(valores.vFrete * 100) + Math.round(valores.vSeg * 100) + Math.round(valores.vOutro * 100) - Math.round(valores.vDesc * 100) + Math.round(valores.vII * 100) + Math.round(valores.vIPI * 100) + Math.round(valores.vIPIDevol * 100) + Math.round(valores.vPIS * 100) + Math.round(valores.vCOFINS * 100) + Math.round(valores.vICMS * 100) + Math.round(valores.vICMSST * 100) + Math.round(valores.vFCP * 100) + Math.round(valores.vFCPST * 100) + Math.round(valores.vFCPSTRet * 100) + Math.round(valores.vFCPUFDest * 100) + Math.round(valores.vICMSUFDest * 100) + Math.round(valores.vICMSUFRemet * 100);
const metodo2 = metodo2Centavos / 100;

console.log(`Método 1 (soma direta): ${metodo1.toFixed(6)}`);
console.log(`Método 2 (centavos)   : ${metodo2.toFixed(6)}`);
console.log(`Diferença             : ${Math.abs(metodo1 - metodo2).toFixed(6)}`);

// Mostrar representação interna
console.log('\n🔬 ANÁLISE DE PRECISÃO:');
console.log(`Método 1 interno: ${metodo1}`);
console.log(`Método 2 interno: ${metodo2}`);

// Método 1 formatado
console.log(`Método 1 .toFixed(2): ${metodo1.toFixed(2)}`);
console.log(`Método 2 .toFixed(2): ${metodo2.toFixed(2)}`);

if (metodo1.toFixed(2) !== metodo2.toFixed(2)) {
  console.log('❌ DIFERENÇA DETECTADA após .toFixed(2)!');
  console.log('Esta é a causa da rejeição 610 na Sefaz AM');
} else {
  console.log('✅ Ambos os métodos resultam no mesmo valor final');
}

console.log('\n💡 EXPLICAÇÃO:');
console.log('A Sefaz AM calcula internamente usando aritmética de inteiros (centavos)');
console.log('Isso evita erros de ponto flutuante que podem ocorrer com decimais');
console.log('Nossa correção replica exatamente o método interno da Sefaz AM');

// Teste com valores que causam problemas de ponto flutuante
console.log('\n🧪 TESTE COM VALORES PROBLEMÁTICOS:');
const valoresProblematicos = [0.1 + 0.2, 1.1 + 2.2, 0.3 * 3];
valoresProblematicos.forEach((val, i) => {
  const centavos = Math.round(val * 100) / 100;
  console.log(`Valor ${i+1}: ${val} vs ${centavos} (dif: ${Math.abs(val - centavos).toFixed(10)})`);
});
const fs = require('fs');
const path = require('path');

// Usar o caminho passado como argumento ou fallback
const xmlPath = process.argv[2] || path.join(__dirname, 'diagnose_output.xml');

console.log(`--- Validação de Totais do XML ---`);

if (!fs.existsSync(xmlPath)) {
    console.error(`Arquivo não encontrado: ${xmlPath}`);
    process.exit(1);
}

const xmlContent = fs.readFileSync(xmlPath, 'utf8');

// Extrair campos de total.ICMSTot
const totalBlock = xmlContent.match(/<total>[\s\S]*?<\/total>/);
if (!totalBlock) {
    console.error('Bloco <total> não encontrado no XML');
    process.exit(1);
}

const totalFields = ['vProd', 'vFrete', 'vSeg', 'vDesc', 'vII', 'vIPI', 'vIPIDevol', 'vPIS', 'vCOFINS', 'vOutro', 'vICMS', 'vNF'];
const totals = {};

totalFields.forEach(field => {
    const regex = new RegExp(`<${field}>([\\d.]+)<\\/${field}>`);
    const match = totalBlock[0].match(regex);
    totals[field] = match ? parseFloat(match[1]) : 0;
});

console.log('Declarado em <total.ICMSTot>:');
console.table(totals);

// Extrair e somar valores dos itens (det)
const detMatches = xmlContent.match(/<det nItem="\d+"[\s\S]*?<\/det>/g) || [];
let somaVProd = 0;
let somaVICMS = 0;
let somaVIPI = 0;
let somaVPIS = 0;
let somaVCOFINS = 0;
let somaVFCP = 0;

detMatches.forEach(det => {
    const vProd = det.match(/<vProd>([\d.]+)<\/vProd>/);
    const vICMS = det.match(/<vICMS>([\d.]+)<\/vICMS>/);
    const vIPI = det.match(/<vIPI>([\d.]+)<\/vIPI>/);
    const vPIS = det.match(/<vPIS>([\d.]+)<\/vPIS>/);
    const vCOFINS = det.match(/<vCOFINS>([\d.]+)<\/vCOFINS>/);
    const vFCP = det.match(/<vFCP>([\d.]+)<\/vFCP>/);
    
    if (vProd) somaVProd += parseFloat(vProd[1]);
    if (vICMS) somaVICMS += parseFloat(vICMS[1]);
    if (vIPI) somaVIPI += parseFloat(vIPI[1]);
    if (vPIS) somaVPIS += parseFloat(vPIS[1]);
    if (vCOFINS) somaVCOFINS += parseFloat(vCOFINS[1]);
    if (vFCP) somaVFCP += parseFloat(vFCP[1]);
});

const recomputed = {
    vProd: Math.round(somaVProd * 100) / 100,
    vICMS: Math.round(somaVICMS * 100) / 100,
    vIPI: Math.round(somaVIPI * 100) / 100,
    vPIS: Math.round(somaVPIS * 100) / 100,
    vCOFINS: Math.round(somaVCOFINS * 100) / 100,
    vFCP: Math.round(somaVFCP * 100) / 100
};

console.log('Recomputado a partir dos itens (soma de det):');
console.table(recomputed);

// Verificar se é regime Simples Nacional (CRT = 1)
const crtMatch = xmlContent.match(/<CRT>([^<]+)<\/CRT>/);
const isSimples = crtMatch && crtMatch[1] === '1';

console.log(`\\nRegime tributário: ${isSimples ? 'Simples Nacional (CRT=1)' : 'Regime Normal (CRT≠1)'}`);

// Para Simples Nacional: vNF = vProd + vFrete + vSeg + vOutro - vDesc
// Para Regime Normal: vNF = vProd + vFrete + vSeg + vOutro - vDesc + vIPI (ICMS, PIS, COFINS podem estar inclusos ou não)
let vNFEsperado;
if (isSimples) {
    // Simples Nacional: impostos geralmente inclusos no vProd
    vNFEsperado = totals.vProd + totals.vFrete + totals.vSeg + totals.vOutro - totals.vDesc;
    console.log(`\\nvNF esperado (Simples): ${totals.vProd} + ${totals.vFrete} + ${totals.vSeg} + ${totals.vOutro} - ${totals.vDesc} = ${vNFEsperado.toFixed(2)}`);
} else {
    // Regime Normal: pode incluir IPI por fora
    vNFEsperado = totals.vProd + totals.vFrete + totals.vSeg + totals.vOutro - totals.vDesc + totals.vIPI;
    console.log(`\\nvNF esperado (Normal): ${totals.vProd} + ${totals.vFrete} + ${totals.vSeg} + ${totals.vOutro} - ${totals.vDesc} + ${totals.vIPI} = ${vNFEsperado.toFixed(2)}`);
}

console.log(`vNF declarado: ${totals.vNF}`);

const diferencaNF = Math.abs(vNFEsperado - totals.vNF);
const nfOK = diferencaNF <= 0.01;

if (nfOK) {
    console.log(`\\n✅ OK: vNF bate com o esperado (diferença ≤ 0.01)`);
} else {
    console.log(`\\n❌ ERRO: há diferença entre vNF declarado e esperado de ${diferencaNF.toFixed(4)}`);
    console.log('Verifique se os impostos estão sendo calculados corretamente.');
}

// Verificar pag.detPag.vPag
const vPagMatch = xmlContent.match(/<pag>[\s\S]*?<vPag>([\d.]+)<\/vPag>/);
const vPag = vPagMatch ? parseFloat(vPagMatch[1]) : 0;
const pagOK = Math.abs(vPag - totals.vNF) <= 0.01;

if (pagOK) {
    console.log('✅ OK: pag.detPag.vPag == total.ICMSTot.vNF');
} else {
    console.log(`❌ ERRO: pag.detPag.vPag (${vPag}) ≠ total.ICMSTot.vNF (${totals.vNF})`);
}

// Verificar se soma de itens confere
const prodOK = Math.abs(recomputed.vProd - totals.vProd) <= 0.01;
const icmsOK = Math.abs(recomputed.vICMS - totals.vICMS) <= 0.01;
const ipiOK = Math.abs(recomputed.vIPI - totals.vIPI) <= 0.01;

console.log(`\\n📊 Verificações dos totais:`);
console.log(`Soma vProd itens = total vProd: ${prodOK ? '✅' : '❌'}`);
console.log(`Soma vICMS itens = total vICMS: ${icmsOK ? '✅' : '❌'}`);
console.log(`Soma vIPI itens = total vIPI: ${ipiOK ? '✅' : '❌'}`);

if (nfOK && pagOK && prodOK && icmsOK && ipiOK) {
    console.log(`\\n🎉 VALIDAÇÃO COMPLETA: XML está correto!`);
    process.exit(0);
} else {
    console.log(`\\n⚠️ VALIDAÇÃO: Há diferenças que precisam ser verificadas.`);
    process.exit(1);
}
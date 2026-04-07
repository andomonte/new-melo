const fs = require('fs');
const xml2js = require('xml2js');

console.log('🔬 ANÁLISE AVANÇADA - REJEIÇÃO 610 SEFAZ AM');
console.log('===========================================');

async function debugSefaz610() {
  try {
    // 1. Ler o envelope SOAP
    if (!fs.existsSync('scripts/envelope-soap.xml')) {
      console.log('❌ Arquivo envelope-soap.xml não encontrado');
      return;
    }

    const envelopeContent = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');
    
    // Extrair apenas a NFe do envelope
    const nfeMatch = envelopeContent.match(/<NFe[^>]*>([\s\S]*?)<\/NFe>/);
    if (!nfeMatch) {
      console.log('❌ NFe não encontrada no envelope');
      return;
    }

    const nfeXml = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">${nfeMatch[1]}</NFe>`;

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const result = await parser.parseStringPromise(nfeXml);

    const infNFe = result.NFe.infNFe;
    const total = infNFe.total.ICMSTot;
    const det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
    const pag = infNFe.pag;

    console.log('\n1️⃣ ANÁLISE DETALHADA DOS TOTAIS:');
    console.log('==================================');
    
    // Extração de todos os valores com análise de formato
    const valores = {
      vProd: parseFloat(total.vProd),
      vFrete: parseFloat(total.vFrete || '0.00'),
      vSeg: parseFloat(total.vSeg || '0.00'),
      vDesc: parseFloat(total.vDesc || '0.00'),
      vII: parseFloat(total.vII || '0.00'),
      vIPI: parseFloat(total.vIPI || '0.00'),
      vIPIDevol: parseFloat(total.vIPIDevol || '0.00'),
      vPIS: parseFloat(total.vPIS || '0.00'),
      vCOFINS: parseFloat(total.vCOFINS || '0.00'),
      vOutro: parseFloat(total.vOutro || '0.00'),
      vICMS: parseFloat(total.vICMS || '0.00'),
      vICMSST: parseFloat(total.vICMSST || '0.00'),
      vFCP: parseFloat(total.vFCP || '0.00'),
      vFCPST: parseFloat(total.vFCPST || '0.00'),
      vFCPSTRet: parseFloat(total.vFCPSTRet || '0.00'),
      vFCPUFDest: parseFloat(total.vFCPUFDest || '0.00'),
      vICMSUFDest: parseFloat(total.vICMSUFDest || '0.00'),
      vICMSUFRemet: parseFloat(total.vICMSUFRemet || '0.00')
    };

    const vNF = parseFloat(total.vNF);

    console.log('Valores extraídos do XML:');
    Object.entries(valores).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log(`vNF: ${vNF}`);

    console.log('\n2️⃣ CÁLCULO EXATO COMO SEFAZ AM:');
    console.log('================================');

    // Método 1: Soma direta (como estava antes)
    const calcDireto = valores.vProd + valores.vFrete + valores.vSeg + valores.vOutro - valores.vDesc + valores.vII + valores.vIPI + valores.vIPIDevol + valores.vPIS + valores.vCOFINS + valores.vICMS + valores.vICMSST + valores.vFCP + valores.vFCPST + valores.vFCPSTRet + valores.vFCPUFDest + valores.vICMSUFDest + valores.vICMSUFRemet;

    // Método 2: Centavos (nossa correção)
    const calcCentavos = (
      Math.round(valores.vProd * 100) + 
      Math.round(valores.vFrete * 100) + 
      Math.round(valores.vSeg * 100) + 
      Math.round(valores.vOutro * 100) - 
      Math.round(valores.vDesc * 100) + 
      Math.round(valores.vII * 100) + 
      Math.round(valores.vIPI * 100) + 
      Math.round(valores.vIPIDevol * 100) + 
      Math.round(valores.vPIS * 100) + 
      Math.round(valores.vCOFINS * 100) + 
      Math.round(valores.vICMS * 100) + 
      Math.round(valores.vICMSST * 100) + 
      Math.round(valores.vFCP * 100) + 
      Math.round(valores.vFCPST * 100) + 
      Math.round(valores.vFCPSTRet * 100) + 
      Math.round(valores.vFCPUFDest * 100) + 
      Math.round(valores.vICMSUFDest * 100) + 
      Math.round(valores.vICMSUFRemet * 100)
    ) / 100;

    console.log(`Cálculo direto: ${calcDireto}`);
    console.log(`Cálculo centavos: ${calcCentavos}`);
    console.log(`vNF no XML: ${vNF}`);

    console.log(`\nDiferença calcDireto vs vNF: ${Math.abs(calcDireto - vNF).toFixed(10)}`);
    console.log(`Diferença calcCentavos vs vNF: ${Math.abs(calcCentavos - vNF).toFixed(10)}`);

    console.log('\n3️⃣ VERIFICAÇÃO DE PAGAMENTO:');
    console.log('=============================');
    
    let vPag = 0;
    if (pag) {
      if (Array.isArray(pag.detPag)) {
        vPag = pag.detPag.reduce((sum, det) => sum + parseFloat(det.vPag || 0), 0);
      } else {
        vPag = parseFloat(pag.detPag.vPag || 0);
      }
    }

    console.log(`vPag: ${vPag}`);
    console.log(`vNF vs vPag diferença: ${Math.abs(vNF - vPag).toFixed(10)}`);

    console.log('\n4️⃣ ANÁLISE DE FORMATO NO XML:');
    console.log('==============================');

    // Verificar formato exato dos valores no XML
    const formatRegex = /<v[A-Z][a-zA-Z]*>([^<]+)<\/v[A-Z][a-zA-Z]*>/g;
    let matches;
    const formatosEncontrados = {};

    while ((matches = formatRegex.exec(nfeXml)) !== null) {
      const tag = matches[0].match(/<(v[A-Z][a-zA-Z]*)/)[1];
      const value = matches[1];
      formatosEncontrados[tag] = value;
    }

    console.log('Formatos encontrados no XML:');
    Object.entries(formatosEncontrados).forEach(([tag, value]) => {
      const casasDecimais = value.includes('.') ? value.split('.')[1].length : 0;
      console.log(`${tag}: "${value}" (${casasDecimais} casas decimais)`);
    });

    console.log('\n5️⃣ ANÁLISE DE CASAS DECIMAIS:');
    console.log('=============================');

    const vNFString = total.vNF;
    const vPagString = pag?.detPag?.vPag || (Array.isArray(pag?.detPag) ? pag.detPag[0]?.vPag : '0');
    
    console.log(`vNF string: "${vNFString}"`);
    console.log(`vPag string: "${vPagString}"`);

    const vNFCasas = vNFString.includes('.') ? vNFString.split('.')[1].length : 0;
    const vPagCasas = vPagString.includes('.') ? vPagString.split('.')[1].length : 0;

    console.log(`vNF casas decimais: ${vNFCasas}`);
    console.log(`vPag casas decimais: ${vPagCasas}`);

    if (vNFCasas !== 2 || vPagCasas !== 2) {
      console.log('⚠️ PROBLEMA DETECTADO: Formatação incorreta das casas decimais!');
    }

    console.log('\n6️⃣ SIMULAÇÃO EXATA DA SEFAZ:');
    console.log('=============================');

    // Simular exatamente como a Sefaz pode estar calculando
    const sefazCalc = Math.round((valores.vProd + valores.vFrete + valores.vSeg + valores.vOutro - valores.vDesc + valores.vII + valores.vIPI + valores.vIPIDevol + valores.vPIS + valores.vCOFINS + valores.vICMS + valores.vICMSST + valores.vFCP + valores.vFCPST + valores.vFCPSTRet + valores.vFCPUFDest + valores.vICMSUFDest + valores.vICMSUFRemet) * 100) / 100;

    console.log(`Simulação Sefaz: ${sefazCalc.toFixed(2)}`);
    console.log(`vNF declarado: ${vNF.toFixed(2)}`);
    console.log(`Match exato: ${sefazCalc.toFixed(2) === vNF.toFixed(2) ? '✅' : '❌'}`);

    console.log('\n7️⃣ VERIFICAÇÃO BYTE A BYTE:');
    console.log('===========================');

    const vNFBytes = Buffer.from(vNF.toFixed(2), 'utf8');
    const calcBytes = Buffer.from(sefazCalc.toFixed(2), 'utf8');

    console.log(`vNF bytes: [${Array.from(vNFBytes).join(', ')}]`);
    console.log(`Calc bytes: [${Array.from(calcBytes).join(', ')}]`);
    console.log(`Bytes idênticos: ${Buffer.compare(vNFBytes, calcBytes) === 0 ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

debugSefaz610();
const fs = require('fs');
const xml2js = require('xml2js');

console.log('🔬 ANÁLISE ULTRA-PROFUNDA - REJEIÇÃO 610 PERSISTENTE');
console.log('===================================================');

async function analiseProfunda() {
  try {
    if (!fs.existsSync('scripts/envelope-soap.xml')) {
      console.log('❌ Envelope não encontrado');
      return;
    }

    const envelopeContent = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');
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

    console.log('\n1️⃣ RECOMPUTAÇÃO EXATA ITEM POR ITEM:');
    console.log('=====================================');

    let somaVProd = 0;
    let somaVICMS = 0;
    let somaVIPI = 0;
    let somaVPIS = 0;
    let somaVCOFINS = 0;

    console.log('Análise detalhada por item:');
    
    det.forEach((item, index) => {
      const vProd = parseFloat(item.prod.vProd);
      const vICMS = parseFloat(item.imposto?.ICMS?.ICMS00?.vICMS || item.imposto?.ICMS?.ICMS20?.vICMS || 0);
      const vIPI = parseFloat(item.imposto?.IPI?.IPITrib?.vIPI || 0);
      const vPIS = parseFloat(item.imposto?.PIS?.PISAliq?.vPIS || 0);
      const vCOFINS = parseFloat(item.imposto?.COFINS?.COFINSAliq?.vCOFINS || 0);
      
      const qCom = parseFloat(item.prod.qCom);
      const vUnCom = parseFloat(item.prod.vUnCom);
      const vProdCalculado = qCom * vUnCom;
      
      console.log(`Item ${index + 1}:`);
      console.log(`  qCom: ${qCom} | vUnCom: ${vUnCom} | vProd calculado: ${vProdCalculado.toFixed(10)} | vProd declarado: ${vProd}`);
      console.log(`  Diferença vProd: ${Math.abs(vProdCalculado - vProd).toFixed(10)}`);
      
      if (Math.abs(vProdCalculado - vProd) > 0.005) {
        console.log(`  ⚠️ INCONSISTÊNCIA DETECTADA no item ${index + 1}!`);
      }
      
      somaVProd += vProd;
      somaVICMS += vICMS;
      somaVIPI += vIPI;
      somaVPIS += vPIS;
      somaVCOFINS += vCOFINS;
    });

    console.log('\n2️⃣ COMPARAÇÃO SOMAS vs TOTAIS DECLARADOS:');
    console.log('==========================================');

    const totalVProd = parseFloat(total.vProd);
    const totalVICMS = parseFloat(total.vICMS);
    const totalVIPI = parseFloat(total.vIPI);
    const totalVPIS = parseFloat(total.vPIS);
    const totalVCOFINS = parseFloat(total.vCOFINS);
    const totalVNF = parseFloat(total.vNF);

    console.log(`Soma itens vProd: ${somaVProd.toFixed(10)}`);
    console.log(`Total declarado: ${totalVProd.toFixed(10)}`);
    console.log(`Diferença vProd: ${Math.abs(somaVProd - totalVProd).toFixed(10)} ${Math.abs(somaVProd - totalVProd) > 0.01 ? '❌' : '✅'}`);

    console.log(`Soma itens vICMS: ${somaVICMS.toFixed(10)}`);
    console.log(`Total declarado: ${totalVICMS.toFixed(10)}`);
    console.log(`Diferença vICMS: ${Math.abs(somaVICMS - totalVICMS).toFixed(10)} ${Math.abs(somaVICMS - totalVICMS) > 0.01 ? '❌' : '✅'}`);

    console.log(`Soma itens vIPI: ${somaVIPI.toFixed(10)}`);
    console.log(`Total declarado: ${totalVIPI.toFixed(10)}`);
    console.log(`Diferença vIPI: ${Math.abs(somaVIPI - totalVIPI).toFixed(10)} ${Math.abs(somaVIPI - totalVIPI) > 0.01 ? '❌' : '✅'}`);

    console.log(`Soma itens vPIS: ${somaVPIS.toFixed(10)}`);
    console.log(`Total declarado: ${totalVPIS.toFixed(10)}`);
    console.log(`Diferença vPIS: ${Math.abs(somaVPIS - totalVPIS).toFixed(10)} ${Math.abs(somaVPIS - totalVPIS) > 0.01 ? '❌' : '✅'}`);

    console.log(`Soma itens vCOFINS: ${somaVCOFINS.toFixed(10)}`);
    console.log(`Total declarado: ${totalVCOFINS.toFixed(10)}`);
    console.log(`Diferença vCOFINS: ${Math.abs(somaVCOFINS - totalVCOFINS).toFixed(10)} ${Math.abs(somaVCOFINS - totalVCOFINS) > 0.01 ? '❌' : '✅'}`);

    console.log('\n3️⃣ RECÁLCULO USANDO MÉTODO SEFAZ AM:');
    console.log('====================================');

    // Método centavos para somas individuais
    const somaVProdCentavos = det.reduce((sum, item) => {
      const vProd = Math.round(parseFloat(item.prod.vProd) * 100);
      return sum + vProd;
    }, 0) / 100;

    const somaVICMSCentavos = det.reduce((sum, item) => {
      const vICMS = Math.round(parseFloat(item.imposto?.ICMS?.ICMS00?.vICMS || item.imposto?.ICMS?.ICMS20?.vICMS || 0) * 100);
      return sum + vICMS;
    }, 0) / 100;

    const somaVIPICentavos = det.reduce((sum, item) => {
      const vIPI = Math.round(parseFloat(item.imposto?.IPI?.IPITrib?.vIPI || 0) * 100);
      return sum + vIPI;
    }, 0) / 100;

    const somaVPISCentavos = det.reduce((sum, item) => {
      const vPIS = Math.round(parseFloat(item.imposto?.PIS?.PISAliq?.vPIS || 0) * 100);
      return sum + vPIS;
    }, 0) / 100;

    const somaVCOFINSCentavos = det.reduce((sum, item) => {
      const vCOFINS = Math.round(parseFloat(item.imposto?.COFINS?.COFINSAliq?.vCOFINS || 0) * 100);
      return sum + vCOFINS;
    }, 0) / 100;

    console.log('MÉTODO CENTAVOS - Somas dos itens:');
    console.log(`vProd centavos: ${somaVProdCentavos.toFixed(2)}`);
    console.log(`vICMS centavos: ${somaVICMSCentavos.toFixed(2)}`);
    console.log(`vIPI centavos: ${somaVIPICentavos.toFixed(2)}`);
    console.log(`vPIS centavos: ${somaVPISCentavos.toFixed(2)}`);
    console.log(`vCOFINS centavos: ${somaVCOFINSCentavos.toFixed(2)}`);

    // Calcular vNF usando centavos
    const vNFCalculadoCentavos = (
      Math.round(somaVProdCentavos * 100) + 
      Math.round(0 * 100) + // vFrete
      Math.round(0 * 100) + // vSeg
      Math.round(0 * 100) + // vOutro
      Math.round(0 * 100) - // vDesc
      Math.round(0 * 100) + // vII
      Math.round(somaVIPICentavos * 100) + 
      Math.round(0 * 100) + // vIPIDevol
      Math.round(somaVPISCentavos * 100) + 
      Math.round(somaVCOFINSCentavos * 100) + 
      Math.round(somaVICMSCentavos * 100) + 
      Math.round(0 * 100) + // vICMSST
      Math.round(0 * 100) + // vFCP
      Math.round(0 * 100) + // vFCPST
      Math.round(0 * 100) + // vFCPSTRet
      Math.round(0 * 100) + // vFCPUFDest
      Math.round(0 * 100) + // vICMSUFDest
      Math.round(0 * 100)   // vICMSUFRemet
    ) / 100;

    console.log('\n4️⃣ COMPARAÇÃO FINAL:');
    console.log('====================');
    console.log(`vNF calculado (método centavos da soma): ${vNFCalculadoCentavos.toFixed(2)}`);
    console.log(`vNF declarado no XML: ${totalVNF.toFixed(2)}`);
    console.log(`Diferença: ${Math.abs(vNFCalculadoCentavos - totalVNF).toFixed(10)}`);
    console.log(`Match: ${vNFCalculadoCentavos.toFixed(2) === totalVNF.toFixed(2) ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analiseProfunda();
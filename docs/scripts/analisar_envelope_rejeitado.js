const fs = require('fs');
const xml2js = require('xml2js');

console.log('🔍 ANÁLISE DO ENVELOPE REJEITADO MAIS RECENTE');
console.log('=============================================');

async function analisarEnvelopeRejeitado() {
  try {
    if (!fs.existsSync('scripts/envelope-soap.xml')) {
      console.log('❌ Envelope SOAP não encontrado');
      return;
    }

    const envelopeContent = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');
    const nfeMatch = envelopeContent.match(/<NFe[^>]*>([\s\S]*?)<\/NFe>/);
    
    if (!nfeMatch) {
      console.log('❌ NFe não encontrada no envelope');
      return;
    }

    const nfeXml = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">${nfeMatch[1]}</NFe>`;

    console.log('1️⃣ VERIFICAÇÃO DE CASAS DECIMAIS:');
    console.log('=================================');

    // Verificar vUnCom e vUnTrib
    const vUnComMatches = nfeXml.match(/<vUnCom>([^<]+)<\/vUnCom>/g) || [];
    const vUnTribMatches = nfeXml.match(/<vUnTrib>([^<]+)<\/vUnTrib>/g) || [];

    console.log(`vUnCom encontrados: ${vUnComMatches.length}`);
    console.log('Primeiros 5 valores:');
    vUnComMatches.slice(0, 5).forEach((match, i) => {
      const valor = match.match(/>([^<]+)</)[1];
      const casas = valor.includes('.') ? valor.split('.')[1].length : 0;
      console.log(`  ${i+1}. "${valor}" (${casas} casas decimais) ${casas <= 4 ? '✅' : '❌'}`);
    });

    console.log(`vUnTrib encontrados: ${vUnTribMatches.length}`);
    console.log('Primeiros 5 valores:');
    vUnTribMatches.slice(0, 5).forEach((match, i) => {
      const valor = match.match(/>([^<]+)</)[1];
      const casas = valor.includes('.') ? valor.split('.')[1].length : 0;
      console.log(`  ${i+1}. "${valor}" (${casas} casas decimais) ${casas <= 4 ? '✅' : '❌'}`);
    });

    console.log('\n2️⃣ VERIFICAÇÃO DE CÁLCULOS DOS ITENS:');
    console.log('=====================================');

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const result = await parser.parseStringPromise(nfeXml);

    const infNFe = result.NFe.infNFe;
    const det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];

    console.log(`Total de itens: ${det.length}`);
    console.log('Verificação dos primeiros 5 itens:');

    let problemasDetectados = 0;

    det.slice(0, 5).forEach((item, index) => {
      const qCom = parseFloat(item.prod.qCom);
      const vUnCom = parseFloat(item.prod.vUnCom);
      const vProd = parseFloat(item.prod.vProd);
      
      const calculadoDireto = qCom * vUnCom;
      const calculadoCentavos = Math.round(qCom * vUnCom * 100) / 100;
      
      const matchDireto = Math.abs(calculadoDireto - vProd) < 0.005;
      const matchCentavos = Math.abs(calculadoCentavos - vProd) < 0.005;
      
      console.log(`Item ${index + 1}:`);
      console.log(`  qCom: ${qCom} | vUnCom: ${vUnCom} | vProd: ${vProd}`);
      console.log(`  Calculado direto: ${calculadoDireto.toFixed(10)}`);
      console.log(`  Calculado centavos: ${calculadoCentavos.toFixed(10)}`);
      console.log(`  Match direto: ${matchDireto ? '✅' : '❌'}`);
      console.log(`  Match centavos: ${matchCentavos ? '✅' : '❌'}`);
      
      if (!matchCentavos) {
        problemasDetectados++;
      }
    });

    console.log('\n3️⃣ VERIFICAÇÃO DOS TOTAIS:');
    console.log('===========================');

    const total = infNFe.total.ICMSTot;
    const vNF = parseFloat(total.vNF);

    // Somar todos os vProd dos itens
    const somaVProdItens = det.reduce((sum, item) => sum + parseFloat(item.prod.vProd), 0);
    
    // Outros valores
    const vFrete = parseFloat(total.vFrete || 0);
    const vSeg = parseFloat(total.vSeg || 0);
    const vDesc = parseFloat(total.vDesc || 0);
    const vOutro = parseFloat(total.vOutro || 0);
    const vII = parseFloat(total.vII || 0);
    const vIPI = parseFloat(total.vIPI || 0);
    const vIPIDevol = parseFloat(total.vIPIDevol || 0);
    const vPIS = parseFloat(total.vPIS || 0);
    const vCOFINS = parseFloat(total.vCOFINS || 0);
    const vICMS = parseFloat(total.vICMS || 0);
    const vICMSST = parseFloat(total.vICMSST || 0);
    const vFCP = parseFloat(total.vFCP || 0);
    const vFCPST = parseFloat(total.vFCPST || 0);
    const vFCPSTRet = parseFloat(total.vFCPSTRet || 0);
    const vFCPUFDest = parseFloat(total.vFCPUFDest || 0);
    const vICMSUFDest = parseFloat(total.vICMSUFDest || 0);
    const vICMSUFRemet = parseFloat(total.vICMSUFRemet || 0);

    const vNFCalculado = somaVProdItens + vFrete + vSeg + vOutro - vDesc + vII + vIPI + vIPIDevol + vPIS + vCOFINS + vICMS + vICMSST + vFCP + vFCPST + vFCPSTRet + vFCPUFDest + vICMSUFDest + vICMSUFRemet;

    console.log(`vNF declarado: ${vNF.toFixed(2)}`);
    console.log(`vNF calculado: ${vNFCalculado.toFixed(10)}`);
    console.log(`Diferença: ${Math.abs(vNF - vNFCalculado).toFixed(10)}`);
    console.log(`Match: ${Math.abs(vNF - vNFCalculado) < 0.01 ? '✅' : '❌'}`);

    console.log('\n4️⃣ DIAGNÓSTICO:');
    console.log('================');
    
    if (problemasDetectados > 0) {
      console.log(`❌ ${problemasDetectados} problemas de cálculo detectados nos itens`);
      console.log('A correção da aritmética de centavos NÃO foi aplicada na emissão real');
    } else {
      console.log('✅ Todos os cálculos dos itens estão corretos');
    }
    
    // Verificar se as casas decimais estão corretas
    const casasDecimaisOK = vUnComMatches.every(match => {
      const valor = match.match(/>([^<]+)</)[1];
      const casas = valor.includes('.') ? valor.split('.')[1].length : 0;
      return casas <= 4;
    });
    
    if (casasDecimaisOK) {
      console.log('✅ Casas decimais vUnCom/vUnTrib estão corretas (≤4)');
    } else {
      console.log('❌ Casas decimais vUnCom/vUnTrib ainda estão incorretas (>4)');
    }

    if (problemasDetectados === 0 && casasDecimaisOK && Math.abs(vNF - vNFCalculado) < 0.01) {
      console.log('\n🤔 MISTÉRIO: Todos os cálculos estão corretos, mas a Sefaz ainda rejeita!');
      console.log('Possíveis causas:');
      console.log('1. Cache da Sefaz com validação antiga');
      console.log('2. Bug específico da Sefaz AM');
      console.log('3. Problema na estrutura do XML não relacionado aos totais');
      console.log('4. Validação interna da Sefaz diferente da documentação');
    }

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analisarEnvelopeRejeitado();
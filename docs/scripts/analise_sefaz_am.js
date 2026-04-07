const fs = require('fs');
const xml2js = require('xml2js');

async function analiseSefazAM() {
  try {
    const xml = fs.readFileSync('scripts/signed.xml', 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const parsed = await parser.parseStringPromise(xml);

    const infNFe = parsed.NFe.infNFe;
    const ICMSTot = infNFe.total.ICMSTot;
    
    console.log('🔍 ANÁLISE ESPECÍFICA PARA SEFAZ AMAZONAS v4.00');
    console.log('====================================================');
    
    // Verificar problemas específicos conhecidos da Sefaz AM
    
    console.log('\n1️⃣ VERIFICAÇÃO DE vBC (BASE DE CÁLCULO ICMS):');
    console.log(`vBC declarado: ${ICMSTot.vBC}`);
    
    // vBC deve ser igual à soma das bases de ICMS dos itens
    const det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
    let somavBC = 0;
    det.forEach(item => {
      const ICMS = item.imposto.ICMS;
      const icmsKey = Object.keys(ICMS)[0];
      const vBCItem = parseFloat(ICMS[icmsKey].vBC || '0');
      somavBC += vBCItem;
    });
    
    console.log(`vBC soma dos itens: ${somavBC.toFixed(2)}`);
    if (Math.abs(parseFloat(ICMSTot.vBC) - somavBC) > 0.01) {
      console.log('❌ PROBLEMA: vBC não confere com soma dos itens');
    } else {
      console.log('✅ vBC correto');
    }

    console.log('\n2️⃣ VERIFICAÇÃO DE vTotTrib (TRIBUTOS ITEM A ITEM):');
    let problemaVTotTrib = false;
    det.forEach((item, idx) => {
      const vTotTrib = parseFloat(item.imposto.vTotTrib || '0');
      const ICMS = item.imposto.ICMS;
      const icmsKey = Object.keys(ICMS)[0];
      const vICMS = parseFloat(ICMS[icmsKey].vICMS || '0');
      const vIPI = parseFloat(item.imposto.IPI?.IPITrib?.vIPI || '0');
      const vPIS = parseFloat(item.imposto.PIS?.PISAliq?.vPIS || '0');
      const vCOFINS = parseFloat(item.imposto.COFINS?.COFINSAliq?.vCOFINS || '0');
      
      const vTotTribCalculado = vICMS + vIPI + vPIS + vCOFINS;
      const diferenca = Math.abs(vTotTrib - vTotTribCalculado);
      
      if (diferenca > 0.01) {
        console.log(`❌ Item ${idx + 1}: vTotTrib=${vTotTrib} vs calculado=${vTotTribCalculado.toFixed(2)} (dif: ${diferenca.toFixed(3)})`);
        problemaVTotTrib = true;
      }
    });
    
    if (!problemaVTotTrib) {
      console.log('✅ Todos os vTotTrib estão corretos');
    }

    console.log('\n3️⃣ VERIFICAÇÃO DE CAMPOS OBRIGATÓRIOS SEFAZ AM:');
    
    // Verificar campos específicos que a Sefaz AM é rigorosa
    const verificacoes = [
      { campo: 'emit.CNPJ', valor: infNFe.emit.CNPJ, deve: 'ter 14 dígitos' },
      { campo: 'emit.IE', valor: infNFe.emit.IE, deve: 'não estar vazio' },
      { campo: 'emit.CRT', valor: infNFe.emit.CRT, deve: 'ser 1, 2 ou 3' },
      { campo: 'ide.serie', valor: infNFe.ide.serie, deve: 'não ser 1 (rejeição 997)' },
      { campo: 'dest.CNPJ', valor: infNFe.dest.CNPJ, deve: 'ter 14 dígitos' }
    ];
    
    verificacoes.forEach(v => {
      console.log(`${v.campo}: ${v.valor} (${v.deve})`);
      if (v.campo === 'ide.serie' && v.valor === '1') {
        console.log('⚠️ ATENÇÃO: Série 1 pode causar rejeição 997 em algumas Sefaz');
      }
      if (v.campo === 'emit.CNPJ' && (!v.valor || v.valor.length !== 14)) {
        console.log('❌ PROBLEMA: CNPJ inválido');
      }
    });

    console.log('\n4️⃣ ANÁLISE DA FÓRMULA vNF SEFAZ AM:');
    // A Sefaz AM pode usar uma fórmula ligeiramente diferente
    const formula1 = parseFloat(ICMSTot.vProd) + parseFloat(ICMSTot.vFrete) + parseFloat(ICMSTot.vSeg) + parseFloat(ICMSTot.vOutro) + parseFloat(ICMSTot.vII) + parseFloat(ICMSTot.vIPI) + parseFloat(ICMSTot.vIPIDevol) + parseFloat(ICMSTot.vPIS) + parseFloat(ICMSTot.vCOFINS) + parseFloat(ICMSTot.vICMS) - parseFloat(ICMSTot.vDesc);
    
    const formula2 = parseFloat(ICMSTot.vProd) + parseFloat(ICMSTot.vFrete) + parseFloat(ICMSTot.vSeg) + parseFloat(ICMSTot.vOutro) - parseFloat(ICMSTot.vDesc) + parseFloat(ICMSTot.vII) + parseFloat(ICMSTot.vIPI) + parseFloat(ICMSTot.vIPIDevol) + parseFloat(ICMSTot.vPIS) + parseFloat(ICMSTot.vCOFINS) + parseFloat(ICMSTot.vICMS);
    
    console.log(`vNF declarado: ${ICMSTot.vNF}`);
    console.log(`Fórmula 1 (tributos no final): ${formula1.toFixed(2)}`);
    console.log(`Fórmula 2 (tributos após desc): ${formula2.toFixed(2)}`);
    
    if (Math.abs(parseFloat(ICMSTot.vNF) - formula1) > 0.01 && Math.abs(parseFloat(ICMSTot.vNF) - formula2) > 0.01) {
      console.log('❌ PROBLEMA: vNF não confere com nenhuma fórmula conhecida');
    }

    console.log('\n5️⃣ VERIFICAÇÃO DE ORDEM DOS ELEMENTOS XML:');
    // A Sefaz AM pode ser sensível à ordem dos elementos
    const xmlLines = xml.split('\n');
    const totalSection = xmlLines.find(line => line.includes('<total>'));
    const pagSection = xmlLines.find(line => line.includes('<pag>'));
    
    if (totalSection && pagSection) {
      const totalIndex = xmlLines.indexOf(totalSection);
      const pagIndex = xmlLines.indexOf(pagSection);
      if (totalIndex > pagIndex) {
        console.log('❌ PROBLEMA: <pag> aparece antes de <total> (ordem incorreta)');
      } else {
        console.log('✅ Ordem dos elementos XML correta');
      }
    }

    console.log('\n6️⃣ ANÁLISE DE PRESENÇA DOS FCP (FUNDO DE COMBATE À POBREZA):');
    // Verificar se FCP está sendo considerado corretamente
    const vFCPTotal = parseFloat(ICMSTot.vFCP || '0');
    console.log(`vFCP no total: ${vFCPTotal}`);
    
    let somaFCPItens = 0;
    det.forEach(item => {
      // Verificar se tem FCP nos itens (pode estar em ICMS ou separado)
      const fcpICMS = parseFloat(item.imposto.ICMS?.[Object.keys(item.imposto.ICMS)[0]]?.vFCP || '0');
      somaFCPItens += fcpICMS;
    });
    
    console.log(`FCP soma dos itens: ${somaFCPItens.toFixed(2)}`);
    
    if (Math.abs(vFCPTotal - somaFCPItens) > 0.01) {
      console.log('⚠️ ATENÇÃO: Divergência no FCP pode estar causando a rejeição');
    }

    console.log('\n🎯 DIAGNÓSTICO FINAL:');
    console.log('A rejeição 610 na Sefaz AM pode ser causada por:');
    console.log('1. Micro-diferenças de arredondamento não detectadas');
    console.log('2. Problemas na estrutura XML (ordem, elementos)');
    console.log('3. Inconsistência no cálculo de FCP');
    console.log('4. Problemas específicos no envelope SOAP enviado');
    
    console.log('\n💡 PRÓXIMA AÇÃO RECOMENDADA:');
    console.log('Verificar o XML real enviado no envelope SOAP para a Sefaz');
    console.log('Pode haver diferenças entre o XML assinado e o XML no envelope');

  } catch (error) {
    console.error('Erro na análise:', error);
  }
}

analiseSefazAM();
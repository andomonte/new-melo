const fs = require('fs');
const xml2js = require('xml2js');

async function analisarCausaRejeicao610() {
  try {
    const xml = fs.readFileSync('scripts/signed.xml', 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const parsed = await parser.parseStringPromise(xml);

    const infNFe = parsed.NFe.infNFe;
    const ICMSTot = infNFe.total.ICMSTot;
    
    console.log('🔍 ANÁLISE DA REJEIÇÃO 610 - SEFAZ AMAZONAS');
    console.log('=================================================');
    
    // Verificar problemas específicos da Sefaz AM v4.00
    
    console.log('\n1️⃣ VERIFICAÇÃO DE CASAS DECIMAIS:');
    const campos = ['vBC', 'vICMS', 'vProd', 'vFrete', 'vSeg', 'vDesc', 'vII', 'vIPI', 'vPIS', 'vCOFINS', 'vOutro', 'vNF'];
    
    let problemaCasasDecimais = false;
    campos.forEach(campo => {
      const valor = ICMSTot[campo];
      if (valor && typeof valor === 'string') {
        const partes = valor.split('.');
        if (partes[1] && partes[1].length > 2) {
          console.log(`❌ ${campo}: ${valor} (${partes[1].length} casas decimais - máximo 2)`);
          problemaCasasDecimais = true;
        } else {
          console.log(`✅ ${campo}: ${valor}`);
        }
      }
    });

    console.log('\n2️⃣ VERIFICAÇÃO DE ARREDONDAMENTO ENTRE ITENS:');
    const det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
    
    let somaManual = {
      vProd: 0,
      vICMS: 0,
      vIPI: 0,
      vPIS: 0,
      vCOFINS: 0
    };

    det.forEach((item, idx) => {
      const vProd = parseFloat(item.prod.vProd || '0');
      somaManual.vProd += vProd;
      
      // ICMS
      const ICMS = item.imposto.ICMS;
      const icmsKey = Object.keys(ICMS)[0];
      const vICMS = parseFloat(ICMS[icmsKey].vICMS || '0');
      somaManual.vICMS += vICMS;
      
      // IPI
      const vIPI = parseFloat(item.imposto.IPI?.IPITrib?.vIPI || '0');
      somaManual.vIPI += vIPI;
      
      // PIS
      const vPIS = parseFloat(item.imposto.PIS?.PISAliq?.vPIS || '0');
      somaManual.vPIS += vPIS;
      
      // COFINS
      const vCOFINS = parseFloat(item.imposto.COFINS?.COFINSAliq?.vCOFINS || '0');
      somaManual.vCOFINS += vCOFINS;

      if (idx < 3) { // Mostrar apenas primeiros 3 itens
        console.log(`Item ${idx + 1}: vProd=${vProd} vICMS=${vICMS} vIPI=${vIPI} vPIS=${vPIS} vCOFINS=${vCOFINS}`);
      }
    });

    // Arredondar somas manuais para 2 casas
    Object.keys(somaManual).forEach(key => {
      somaManual[key] = Math.round(somaManual[key] * 100) / 100;
    });

    console.log(`\nSoma manual dos itens: vProd=${somaManual.vProd} vICMS=${somaManual.vICMS} vIPI=${somaManual.vIPI} vPIS=${somaManual.vPIS} vCOFINS=${somaManual.vCOFINS}`);
    console.log(`Declarado no total : vProd=${ICMSTot.vProd} vICMS=${ICMSTot.vICMS} vIPI=${ICMSTot.vIPI} vPIS=${ICMSTot.vPIS} vCOFINS=${ICMSTot.vCOFINS}`);

    console.log('\n3️⃣ VERIFICAÇÃO DA FÓRMULA vNF:');
    const vNFDeclarado = parseFloat(ICMSTot.vNF);
    const vNFCalculado = parseFloat(ICMSTot.vProd) + 
                        parseFloat(ICMSTot.vFrete || '0') + 
                        parseFloat(ICMSTot.vSeg || '0') + 
                        parseFloat(ICMSTot.vOutro || '0') - 
                        parseFloat(ICMSTot.vDesc || '0') + 
                        parseFloat(ICMSTot.vII || '0') + 
                        parseFloat(ICMSTot.vIPI) + 
                        parseFloat(ICMSTot.vIPIDevol || '0') + 
                        parseFloat(ICMSTot.vPIS) + 
                        parseFloat(ICMSTot.vCOFINS) + 
                        parseFloat(ICMSTot.vICMS);
    
    const vNFCalculadoRounded = Math.round(vNFCalculado * 100) / 100;
    
    console.log(`vNF Declarado: ${vNFDeclarado}`);
    console.log(`vNF Calculado: ${vNFCalculadoRounded}`);
    console.log(`Diferença: ${Math.abs(vNFDeclarado - vNFCalculadoRounded).toFixed(4)}`);

    console.log('\n4️⃣ VERIFICAÇÃO ESPECÍFICA SEFAZ AM:');
    
    // Verificar se vNF = vProd + impostos (sem descontos etc)
    const vNFSimples = somaManual.vProd + somaManual.vICMS + somaManual.vIPI + somaManual.vPIS + somaManual.vCOFINS;
    const vNFSimplesRounded = Math.round(vNFSimples * 100) / 100;
    
    console.log(`vNF pela soma simples dos itens: ${vNFSimplesRounded}`);
    console.log(`vNF declarado: ${vNFDeclarado}`);
    console.log(`Diferença simples: ${Math.abs(vNFDeclarado - vNFSimplesRounded).toFixed(4)}`);

    // Verificar pag.detPag.vPag
    const vPag = parseFloat(infNFe.pag.detPag.vPag);
    console.log(`vPag: ${vPag} (deve ser igual a vNF)`);

    console.log('\n🎯 POSSÍVEIS CAUSAS DA REJEIÇÃO:');
    
    if (problemaCasasDecimais) {
      console.log('❌ CAUSA PROVÁVEL: Campos com mais de 2 casas decimais');
    }
    
    if (Math.abs(vNFDeclarado - vNFSimplesRounded) > 0.01) {
      console.log(`❌ CAUSA PROVÁVEL: Diferença de arredondamento (${Math.abs(vNFDeclarado - vNFSimplesRounded).toFixed(4)})`);
    }
    
    if (vNFDeclarado !== vPag) {
      console.log('❌ CAUSA PROVÁVEL: vNF ≠ vPag');
    }

    console.log('\n📋 RECOMENDAÇÕES:');
    console.log('1. Garantir que todos os valores tenham exatamente 2 casas decimais (.toFixed(2))');
    console.log('2. Arredondar DEPOIS de somar, não antes');
    console.log('3. Verificar se a fórmula vNF está seguindo exatamente o manual da Sefaz AM v4.00');

  } catch (error) {
    console.error('Erro na análise:', error);
  }
}

analisarCausaRejeicao610();
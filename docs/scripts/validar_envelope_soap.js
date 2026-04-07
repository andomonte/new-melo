const fs = require('fs');
const xml2js = require('xml2js');

async function validarEnvelopeSOAP() {
  try {
    // Verificar se os arquivos de envelope existem
    if (!fs.existsSync('scripts/envelope-soap.xml')) {
      console.log('❌ Arquivo envelope-soap.xml não encontrado');
      console.log('Execute uma emissão de NFe primeiro para gerar os arquivos');
      return;
    }

    console.log('🔍 VALIDAÇÃO DO ENVELOPE SOAP ENVIADO PARA SEFAZ');
    console.log('==================================================');

    // Ler envelope SOAP
    const envelopeContent = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');
    console.log('\n1️⃣ ESTRUTURA DO ENVELOPE:');
    console.log('Tamanho do envelope:', envelopeContent.length, 'caracteres');
    
    // Extrair XML da NFe de dentro do envelope
    const nfeMatch = envelopeContent.match(/<NFe[^>]*>[\s\S]*?<\/NFe>/);
    if (!nfeMatch) {
      console.log('❌ NFe não encontrada no envelope SOAP');
      return;
    }

    const nfeXML = '<?xml version="1.0" encoding="UTF-8"?>\n' + nfeMatch[0];
    
    // Salvar NFe extraída para validação
    fs.writeFileSync('scripts/nfe-from-envelope.xml', nfeXML, 'utf8');
    console.log('✅ NFe extraída do envelope e salva em scripts/nfe-from-envelope.xml');

    // Parsear e validar
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const parsed = await parser.parseStringPromise(nfeXML);
    const infNFe = parsed.NFe.infNFe;
    const ICMSTot = infNFe.total.ICMSTot;

    console.log('\n2️⃣ TOTAIS EXTRAÍDOS DO ENVELOPE:');
    console.log('vProd:', ICMSTot.vProd);
    console.log('vICMS:', ICMSTot.vICMS);
    console.log('vIPI:', ICMSTot.vIPI);
    console.log('vPIS:', ICMSTot.vPIS);
    console.log('vCOFINS:', ICMSTot.vCOFINS);
    console.log('vNF:', ICMSTot.vNF);
    console.log('vPag:', infNFe.pag.detPag.vPag);

    // Recompute manual
    const det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
    let soma = {
      vProd: 0,
      vICMS: 0,
      vIPI: 0,
      vPIS: 0,
      vCOFINS: 0
    };

    det.forEach(item => {
      soma.vProd += parseFloat(item.prod.vProd || '0');
      
      const ICMS = item.imposto.ICMS;
      const icmsKey = Object.keys(ICMS)[0];
      soma.vICMS += parseFloat(ICMS[icmsKey].vICMS || '0');
      
      soma.vIPI += parseFloat(item.imposto.IPI?.IPITrib?.vIPI || '0');
      soma.vPIS += parseFloat(item.imposto.PIS?.PISAliq?.vPIS || '0');
      soma.vCOFINS += parseFloat(item.imposto.COFINS?.COFINSAliq?.vCOFINS || '0');
    });

    const vNFCalculado = soma.vProd + soma.vICMS + soma.vIPI + soma.vPIS + soma.vCOFINS;

    console.log('\n3️⃣ RECOMPUTE MANUAL DO ENVELOPE:');
    console.log('vProd calculado:', soma.vProd.toFixed(2));
    console.log('vICMS calculado:', soma.vICMS.toFixed(2));
    console.log('vIPI calculado:', soma.vIPI.toFixed(2));
    console.log('vPIS calculado:', soma.vPIS.toFixed(2));
    console.log('vCOFINS calculado:', soma.vCOFINS.toFixed(2));
    console.log('vNF calculado:', vNFCalculado.toFixed(2));

    console.log('\n4️⃣ COMPARAÇÃO FINAL:');
    const vNFDeclarado = parseFloat(ICMSTot.vNF);
    const diferenca = Math.abs(vNFDeclarado - vNFCalculado);
    
    console.log(`vNF declarado: ${vNFDeclarado.toFixed(2)}`);
    console.log(`vNF calculado: ${vNFCalculado.toFixed(2)}`);
    console.log(`Diferença: ${diferenca.toFixed(6)}`);

    if (diferenca > 0.01) {
      console.log('❌ PROBLEMA ENCONTRADO: Diferença > 0.01 no envelope SOAP!');
      console.log('Esta é provavelmente a causa da rejeição 610');
    } else {
      console.log('✅ Totais corretos no envelope SOAP');
      console.log('⚠️ O problema pode estar na interpretação da Sefaz ou na transmissão');
    }

    console.log('\n5️⃣ VERIFICAÇÃO DE NAMESPACE:');
    if (envelopeContent.includes('xmlns="http://www.portalfiscal.inf.br/nfe"')) {
      console.log('✅ Namespace correto encontrado');
    } else {
      console.log('❌ Namespace pode estar incorreto');
    }

    // Comparar com signed.xml
    if (fs.existsSync('scripts/signed.xml')) {
      const signedContent = fs.readFileSync('scripts/signed.xml', 'utf8');
      const signedParser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const signedParsed = await signedParser.parseStringPromise(signedContent);
      const signedVNF = parseFloat(signedParsed.NFe.infNFe.total.ICMSTot.vNF);
      
      console.log('\n6️⃣ COMPARAÇÃO COM SIGNED.XML:');
      console.log(`vNF signed.xml: ${signedVNF.toFixed(2)}`);
      console.log(`vNF envelope: ${vNFDeclarado.toFixed(2)}`);
      
      if (Math.abs(signedVNF - vNFDeclarado) > 0.001) {
        console.log('❌ PROBLEMA CRÍTICO: vNF mudou entre assinatura e envelope!');
      } else {
        console.log('✅ vNF mantido entre assinatura e envelope');
      }
    }

  } catch (error) {
    console.error('Erro na validação do envelope:', error);
  }
}

validarEnvelopeSOAP();
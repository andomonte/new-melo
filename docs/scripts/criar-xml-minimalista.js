const fs = require('fs');
const { create } = require('xmlbuilder2');

// Criar XML NFC-e ULTRA MINIMALISTA baseado no manual da SEFAZ
function criarXMLMinimalista() {
  console.log('🧪 CRIANDO XML NFC-e ULTRA MINIMALISTA PARA TESTE');
  console.log('================================================\n');

  // Dados mínimos obrigatórios
  const dhEmi = new Date();
  const chaveAcesso = '13251018053139000169650020017019999999999999'; // Chave fixa para teste
  
  console.log('📋 Dados do teste:');
  console.log('  Chave:', chaveAcesso);
  console.log('  Data:', dhEmi.toISOString());
  
  // Criar XML com estrutura EXATAMENTE como no manual
  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  
  const nfe = doc.ele('NFe', { 
    xmlns: 'http://www.portalfiscal.inf.br/nfe'
  });
  
  const infNFe = nfe.ele('infNFe', {
    versao: '4.00',
    Id: `NFe${chaveAcesso}`
  });

  // IDE - Identificação (MÍNIMO ABSOLUTO)
  const ide = infNFe.ele('ide');
  ide.ele('cUF').txt('13').up();
  ide.ele('cNF').txt('99999999').up();
  ide.ele('natOp').txt('VENDA').up();
  ide.ele('mod').txt('65').up();
  ide.ele('serie').txt('1').up();
  ide.ele('nNF').txt('1999999').up();
  ide.ele('dhEmi').txt('2025-10-17T16:25:00-04:00').up();
  ide.ele('tpNF').txt('1').up();
  ide.ele('idDest').txt('1').up();
  ide.ele('cMunFG').txt('1302603').up();
  ide.ele('tpImp').txt('4').up();
  ide.ele('tpEmis').txt('1').up();
  ide.ele('cDV').txt('9').up();
  ide.ele('tpAmb').txt('2').up();
  ide.ele('finNFe').txt('1').up();
  ide.ele('indFinal').txt('1').up();
  ide.ele('indPres').txt('1').up();
  ide.ele('procEmi').txt('0').up();
  ide.ele('verProc').txt('1.0').up();
  ide.up();

  // EMIT - Emitente (MÍNIMO)
  const emit = infNFe.ele('emit');
  emit.ele('CNPJ', '18053139000169');
  emit.ele('xNome', 'EMPRESA TESTE LTDA');
  emit.ele('enderEmit')
    .ele('xLgr', 'RUA TESTE')
    .up().ele('nro', '123')
    .up().ele('xBairro', 'CENTRO')
    .up().ele('cMun', '1302603')
    .up().ele('xMun', 'MANAUS')
    .up().ele('UF', 'AM')
    .up().ele('CEP', '69000000')
    .up().ele('cPais', '1058')
    .up().ele('xPais', 'BRASIL');
  emit.ele('IE', '123456789');
  emit.ele('CRT', '1');

  // DEST - Destinatário (CONSUMIDOR FINAL)
  const dest = infNFe.ele('dest');
  dest.ele('CPF', '12345678901');
  dest.ele('xNome', 'CONSUMIDOR TESTE');
  dest.ele('indIEDest', '9');

  // DET - Produto (1 ITEM SIMPLES)
  const det = infNFe.ele('det', { nItem: '1' });
  const prod = det.ele('prod');
  prod.ele('cProd', '001');
  prod.ele('cEAN');
  prod.ele('xProd', 'PRODUTO TESTE');
  prod.ele('NCM', '99999999');
  prod.ele('CFOP', '5102');
  prod.ele('uCom', 'UN');
  prod.ele('qCom', '1.0000');
  prod.ele('vUnCom', '10.0000');
  prod.ele('vProd', '10.00');
  prod.ele('cEANTrib');
  prod.ele('uTrib', 'UN');
  prod.ele('qTrib', '1.0000');
  prod.ele('vUnTrib', '10.0000');
  prod.ele('indTot', '1');

  // IMPOSTO (SIMPLES NACIONAL)
  const imposto = det.ele('imposto');
  imposto.ele('ICMS').ele('ICMSSN102')
    .ele('orig', '0')
    .up().ele('CSOSN', '102');
  imposto.ele('PIS').ele('PISNT').ele('CST', '07');
  imposto.ele('COFINS').ele('COFINSNT').ele('CST', '07');

  // TOTAL
  const total = infNFe.ele('total').ele('ICMSTot');
  total.ele('vBC', '0.00');
  total.ele('vICMS', '0.00');
  total.ele('vICMSDeson', '0.00');
  total.ele('vFCP', '0.00');
  total.ele('vBCST', '0.00');
  total.ele('vST', '0.00');
  total.ele('vFCPST', '0.00');
  total.ele('vFCPSTRet', '0.00');
  total.ele('vProd', '10.00');
  total.ele('vFrete', '0.00');
  total.ele('vSeg', '0.00');
  total.ele('vDesc', '0.00');
  total.ele('vII', '0.00');
  total.ele('vIPI', '0.00');
  total.ele('vIPIDevol', '0.00');
  total.ele('vPIS', '0.00');
  total.ele('vCOFINS', '0.00');
  total.ele('vOutro', '0.00');
  total.ele('vNF', '10.00');

  // TRANSP
  infNFe.ele('transp').ele('modFrete', '9');

  // PAG
  infNFe.ele('pag').ele('detPag')
    .ele('tPag', '01')
    .up().ele('vPag', '10.00');

  const xml = doc.end({ prettyPrint: true });
  
  // Salvar XML para teste
  fs.writeFileSync('xml-nfce-minimalista.xml', xml);
  
  console.log('\n✅ XML minimalista criado!');
  console.log('📁 Arquivo: xml-nfce-minimalista.xml');
  console.log('📄 Tamanho:', xml.length, 'caracteres');
  
  console.log('\n🔍 ESTRUTURA MINIMALISTA:');
  console.log('- 1 produto simples (R$ 10,00)');
  console.log('- Campos obrigatórios apenas');
  console.log('- NCM genérico (99999999)');
  console.log('- CPF fake para teste');
  console.log('- Sem caracteres especiais');
  
  console.log('\n📋 PRÓXIMO TESTE:');
  console.log('1. Substituir o XML atual por este minimalista');
  console.log('2. Se funcionar: o problema está nos dados do produto real');
  console.log('3. Se não funcionar: problema no schema fundamental');
  
  return xml;
}

// Executar
try {
  const xml = criarXMLMinimalista();
  console.log('\n🧪 XML de teste pronto para usar!');
} catch (error) {
  console.error('❌ Erro:', error.message);
}
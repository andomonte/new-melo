const fs = require('fs');

console.log('🔍 COMPARAÇÃO ENVELOPE REJEITADO vs XML CORRETO');
console.log('===============================================');

function analisarCasasDecimais(xml, nome) {
  console.log(`\n📋 ANÁLISE: ${nome}`);
  console.log('================================');

  // Verificar vUnCom e vUnTrib
  const vUnComMatches = xml.match(/<vUnCom>([^<]+)<\/vUnCom>/g) || [];
  const vUnTribMatches = xml.match(/<vUnTrib>([^<]+)<\/vUnTrib>/g) || [];

  console.log('vUnCom encontrados:', vUnComMatches.length);
  vUnComMatches.slice(0, 3).forEach((match, i) => {
    const valor = match.match(/>([^<]+)</)[1];
    const casas = valor.includes('.') ? valor.split('.')[1].length : 0;
    console.log(`  ${i+1}. "${valor}" (${casas} casas decimais) ${casas > 4 ? '❌ INVÁLIDO' : '✅ VÁLIDO'}`);
  });

  console.log('vUnTrib encontrados:', vUnTribMatches.length);
  vUnTribMatches.slice(0, 3).forEach((match, i) => {
    const valor = match.match(/>([^<]+)</)[1];
    const casas = valor.includes('.') ? valor.split('.')[1].length : 0;
    console.log(`  ${i+1}. "${valor}" (${casas} casas decimais) ${casas > 4 ? '❌ INVÁLIDO' : '✅ VÁLIDO'}`);
  });

  // Verificar totais
  const totalMatches = xml.match(/<total>[\s\S]*?<\/total>/);
  if (totalMatches) {
    const total = totalMatches[0];
    const vNFMatch = total.match(/<vNF>([^<]+)<\/vNF>/);
    const vPagMatch = xml.match(/<vPag>([^<]+)<\/vPag>/);

    if (vNFMatch) {
      const vNF = vNFMatch[1];
      const casas = vNF.includes('.') ? vNF.split('.')[1].length : 0;
      console.log(`vNF: "${vNF}" (${casas} casas decimais) ${casas === 2 ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
    }

    if (vPagMatch) {
      const vPag = vPagMatch[1];
      const casas = vPag.includes('.') ? vPag.split('.')[1].length : 0;
      console.log(`vPag: "${vPag}" (${casas} casas decimais) ${casas === 2 ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
    }
  }
}

try {
  // Analisar envelope rejeitado (se existir)
  if (fs.existsSync('scripts/envelope-soap.xml')) {
    const envelope = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');
    analisarCasasDecimais(envelope, 'ENVELOPE REJEITADO');
  } else {
    console.log('❌ Envelope rejeitado não encontrado');
  }

  // Analisar XML de teste atual
  if (fs.existsSync('scripts/diagnose_output.xml')) {
    const xmlTeste = fs.readFileSync('scripts/diagnose_output.xml', 'utf8');
    analisarCasasDecimais(xmlTeste, 'XML TESTE CORRIGIDO');
  } else {
    console.log('❌ XML de teste não encontrado');
  }

  console.log('\n🎯 CONCLUSÃO:');
  console.log('==============');
  console.log('Se o envelope rejeitado tinha vUnCom/vUnTrib com 10 casas decimais,');
  console.log('e o XML corrigido tem apenas 4 casas, então encontramos a causa da rejeição!');
  console.log('');
  console.log('A Sefaz AM pode estar rejeitando por:');
  console.log('1. Excesso de casas decimais em vUnCom/vUnTrib (máximo 4 permitidas)');
  console.log('2. Validação rigorosa de formato conforme o manual técnico');

} catch (error) {
  console.error('❌ Erro na análise:', error);
}
const fs = require('fs');

console.log('🔍 ANÁLISE ESTRUTURAL PROFUNDA - SEFAZ AM MISTÉRIO');
console.log('==================================================');

function analisarEstruturaProfunda() {
  try {
    if (!fs.existsSync('scripts/envelope-soap.xml')) {
      console.log('❌ Envelope não encontrado');
      return;
    }

    const envelopeContent = fs.readFileSync('scripts/envelope-soap.xml', 'utf8');

    console.log('1️⃣ ANÁLISE DE CARACTERES ESPECIAIS:');
    console.log('===================================');

    // Verificar encoding
    const hasUTF8BOM = envelopeContent.charCodeAt(0) === 0xFEFF;
    console.log(`UTF-8 BOM presente: ${hasUTF8BOM ? '⚠️ SIM' : '✅ NÃO'}`);

    // Verificar caracteres não-ASCII
    const nonAsciiChars = envelopeContent.match(/[^\x00-\x7F]/g) || [];
    console.log(`Caracteres não-ASCII: ${nonAsciiChars.length}`);
    if (nonAsciiChars.length > 0) {
      const uniqueChars = [...new Set(nonAsciiChars)];
      console.log(`Caracteres únicos: ${uniqueChars.slice(0, 10).join(', ')}`);
    }

    console.log('\n2️⃣ ANÁLISE DE NAMESPACES E VERSÕES:');
    console.log('===================================');

    // Verificar versão da NFe
    const versaoMatch = envelopeContent.match(/versao="([^"]+)"/);
    console.log(`Versão NFe: ${versaoMatch ? versaoMatch[1] : 'NÃO ENCONTRADA'}`);

    // Verificar namespaces
    const nfeNamespace = envelopeContent.includes('xmlns="http://www.portalfiscal.inf.br/nfe"');
    console.log(`Namespace NFe correto: ${nfeNamespace ? '✅' : '❌'}`);

    console.log('\n3️⃣ ANÁLISE DE FORMATO DE VALORES:');
    console.log('==================================');

    // Verificar padrões de valores monetários
    const valoresMonetarios = envelopeContent.match(/<v[A-Z][a-zA-Z]*>([0-9]+\.[0-9]+)<\/v[A-Z][a-zA-Z]*>/g) || [];
    
    console.log(`Total de valores monetários: ${valoresMonetarios.length}`);
    
    // Agrupar por número de casas decimais
    const casasDecimais = {};
    valoresMonetarios.forEach(val => {
      const numero = val.match(/>([^<]+)</)[1];
      const casas = numero.split('.')[1]?.length || 0;
      casasDecimais[casas] = (casasDecimais[casas] || 0) + 1;
    });

    console.log('Distribuição de casas decimais:');
    Object.entries(casasDecimais).forEach(([casas, count]) => {
      console.log(`  ${casas} casas: ${count} valores`);
    });

    console.log('\n4️⃣ VERIFICAÇÃO DE ELEMENTOS VAZIOS/NULOS:');
    console.log('=========================================');

    // Elementos com valor zero
    const elementosZero = [
      envelopeContent.match(/<vFrete>0\.00<\/vFrete>/g)?.length || 0,
      envelopeContent.match(/<vSeg>0\.00<\/vSeg>/g)?.length || 0,
      envelopeContent.match(/<vDesc>0\.00<\/vDesc>/g)?.length || 0,
      envelopeContent.match(/<vOutro>0\.00<\/vOutro>/g)?.length || 0
    ];

    console.log('Elementos zerados:');
    console.log(`  vFrete: ${elementosZero[0]}`);
    console.log(`  vSeg: ${elementosZero[1]}`);
    console.log(`  vDesc: ${elementosZero[2]}`);
    console.log(`  vOutro: ${elementosZero[3]}`);

    console.log('\n5️⃣ ANÁLISE DE TAGS DUPLICADAS:');
    console.log('===============================');

    const tagsCriticas = ['vProd', 'vNF', 'vPag', 'vICMS', 'vIPI', 'vPIS', 'vCOFINS'];
    tagsCriticas.forEach(tag => {
      const regex = new RegExp(`<${tag}>`, 'g');
      const matches = envelopeContent.match(regex) || [];
      console.log(`${tag}: ${matches.length} ocorrências`);
    });

    console.log('\n6️⃣ VERIFICAÇÃO DE FORMATAÇÃO DE NÚMEROS:');
    console.log('========================================');

    // Verificar se há números sem .00
    const numerosInteiros = envelopeContent.match(/<v[A-Z][a-zA-Z]*>[0-9]+<\/v[A-Z][a-zA-Z]*>/g) || [];
    console.log(`Números sem casas decimais: ${numerosInteiros.length}`);
    if (numerosInteiros.length > 0) {
      console.log('Primeiros valores sem decimais:');
      numerosInteiros.slice(0, 5).forEach(val => console.log(`  ${val}`));
    }

    console.log('\n7️⃣ ANÁLISE DE SEQUÊNCIA DE ITENS:');
    console.log('==================================');

    const itensNumeracao = envelopeContent.match(/nItem="(\d+)"/g) || [];
    console.log(`Total de itens: ${itensNumeracao.length}`);
    
    // Verificar sequência
    const numeros = itensNumeracao.map(item => parseInt(item.match(/\d+/)[0]));
    const sequenciaCorreta = numeros.every((num, index) => num === index + 1);
    console.log(`Sequência de itens correta: ${sequenciaCorreta ? '✅' : '❌'}`);

    if (!sequenciaCorreta) {
      console.log(`Números encontrados: ${numeros.slice(0, 10).join(', ')}...`);
    }

    console.log('\n8️⃣ POSSÍVEIS CAUSAS OCULTAS:');
    console.log('=============================');
    console.log('🔍 Hipóteses para rejeição 610 mesmo com cálculos corretos:');
    console.log('');
    console.log('1. 🎯 PROBLEMA DE TIMESTAMP/TIMEZONE');
    console.log('   A Sefaz pode estar validando com timestamp diferente');
    console.log('');
    console.log('2. 🎯 CACHE/SESSÃO DA SEFAZ');
    console.log('   Validação antiga ainda em cache no servidor');
    console.log('');
    console.log('3. 🎯 PROBLEMA DE CODIFICAÇÃO');
    console.log('   Caracteres invisíveis ou encoding específico');
    console.log('');
    console.log('4. 🎯 VALIDAÇÃO DE SEQUÊNCIA');
    console.log('   Ordem dos elementos ou atributos específica');
    console.log('');
    console.log('5. 🎯 BUG ESPECÍFICO SEFAZ AM');
    console.log('   Validação interna com lógica diferente da documentação');
    console.log('');
    console.log('6. 🎯 PROBLEMA NA ASSINATURA DIGITAL');
    console.log('   Alteração mínima no XML após assinatura');

    // Verificar timestamp
    const dhEmiMatch = envelopeContent.match(/<dhEmi>([^<]+)<\/dhEmi>/);
    if (dhEmiMatch) {
      console.log(`\n📅 Data/hora emissão: ${dhEmiMatch[1]}`);
      const agora = new Date().toISOString();
      console.log(`📅 Data/hora atual: ${agora}`);
    }

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analisarEstruturaProfunda();
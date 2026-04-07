const fs = require('fs');
const path = require('path');

// Função para analisar profundamente o XML NFC-e
function analisarSchemaXML() {
  console.log('🔍 ANÁLISE DETALHADA DO SCHEMA XML NFC-e');
  console.log('=====================================\n');

  // Vamos simular um XML baseado no que foi enviado
  const xmlEnviado = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>1760730032581</idLote>
  <indSinc>1</indSinc>
  <NFe>
  <infNFe versao="4.00" Id="NFe13251018053139000169650020017018721608745582">
    <ide>
      <cUF>13</cUF>
      <cNF>60874558</cNF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>2</serie>
      <nNF>1701872</nNF>
      <dhEmi>2025-10-17T15:40:31-04:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>1302603</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>2</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
  </infNFe>
</NFe>
</enviNFe>`;

  console.log('📋 VERIFICAÇÕES ESPECÍFICAS PARA ERRO 215:');
  console.log('==========================================\n');

  // 1. Verificar namespace
  console.log('1️⃣ NAMESPACE:');
  const namespaceMatch = xmlEnviado.match(/xmlns="([^"]+)"/);
  if (namespaceMatch) {
    const namespace = namespaceMatch[1];
    console.log(`   ✅ Namespace encontrado: ${namespace}`);
    if (namespace === 'http://www.portalfiscal.inf.br/nfe') {
      console.log('   ✅ Namespace correto para NFC-e');
    } else {
      console.log('   ❌ Namespace incorreto!');
    }
  }

  // 2. Verificar versão
  console.log('\n2️⃣ VERSÃO:');
  const versaoMatch = xmlEnviado.match(/versao="([^"]+)"/);
  if (versaoMatch) {
    const versao = versaoMatch[1];
    console.log(`   ✅ Versão encontrada: ${versao}`);
    if (versao === '4.00') {
      console.log('   ✅ Versão 4.00 correta');
    } else {
      console.log('   ❌ Versão incorreta! Deve ser 4.00');
    }
  }

  // 3. Verificar modelo
  console.log('\n3️⃣ MODELO:');
  const modeloMatch = xmlEnviado.match(/<mod>(\d+)<\/mod>/);
  if (modeloMatch) {
    const modelo = modeloMatch[1];
    console.log(`   ✅ Modelo encontrado: ${modelo}`);
    if (modelo === '65') {
      console.log('   ✅ Modelo 65 (NFC-e) correto');
    } else {
      console.log('   ❌ Modelo incorreto! Deve ser 65 para NFC-e');
    }
  }

  // 4. Verificar estrutura básica
  console.log('\n4️⃣ ESTRUTURA XML:');
  const temEnviNFe = xmlEnviado.includes('<enviNFe');
  const temIdLote = xmlEnviado.includes('<idLote>');
  const temIndSinc = xmlEnviado.includes('<indSinc>');
  const temNFe = xmlEnviado.includes('<NFe>');
  const temInfNFe = xmlEnviado.includes('<infNFe');
  
  console.log(`   enviNFe: ${temEnviNFe ? '✅' : '❌'}`);
  console.log(`   idLote: ${temIdLote ? '✅' : '❌'}`);
  console.log(`   indSinc: ${temIndSinc ? '✅' : '❌'}`);
  console.log(`   NFe: ${temNFe ? '✅' : '❌'}`);
  console.log(`   infNFe: ${temInfNFe ? '✅' : '❌'}`);

  // 5. Problemas conhecidos de schema
  console.log('\n5️⃣ PROBLEMAS COMUNS DE SCHEMA:');
  
  // Data/Hora - formato muito específico
  const dhEmiMatch = xmlEnviado.match(/<dhEmi>([^<]+)<\/dhEmi>/);
  if (dhEmiMatch) {
    const dhEmi = dhEmiMatch[1];
    console.log(`   📅 Data/Hora: ${dhEmi}`);
    
    // Verificar formato ISO 8601 com timezone
    const formatoCorreto = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(dhEmi);
    console.log(`   ${formatoCorreto ? '✅' : '❌'} Formato da data: ${formatoCorreto ? 'correto' : 'incorreto'}`);
    
    if (!formatoCorreto) {
      console.log('   ⚠️  Formato esperado: YYYY-MM-DDTHH:MM:SS+HH:MM');
    }
  }

  // Chave de acesso - deve ter 44 dígitos
  const idMatch = xmlEnviado.match(/Id="NFe(\d+)"/);
  if (idMatch) {
    const chaveAcesso = idMatch[1];
    console.log(`   🔑 Chave de acesso: ${chaveAcesso}`);
    console.log(`   📏 Tamanho: ${chaveAcesso.length} dígitos`);
    
    if (chaveAcesso.length === 44) {
      console.log('   ✅ Tamanho da chave correto (44 dígitos)');
    } else {
      console.log('   ❌ Tamanho da chave incorreto! Deve ter 44 dígitos');
    }
  }

  // 6. Verificar campos obrigatórios específicos da NFC-e
  console.log('\n6️⃣ CAMPOS OBRIGATÓRIOS NFC-e:');
  
  const camposObrigatorios = [
    { tag: 'cUF', nome: 'Código da UF' },
    { tag: 'cNF', nome: 'Código numérico' },
    { tag: 'natOp', nome: 'Natureza da operação' },
    { tag: 'mod', nome: 'Modelo do documento' },
    { tag: 'serie', nome: 'Série' },
    { tag: 'nNF', nome: 'Número da NF' },
    { tag: 'dhEmi', nome: 'Data/hora de emissão' },
    { tag: 'tpNF', nome: 'Tipo da NF' },
    { tag: 'idDest', nome: 'Identificação do destinatário' },
    { tag: 'cMunFG', nome: 'Código do município' },
    { tag: 'tpImp', nome: 'Tipo de impressão' },
    { tag: 'tpEmis', nome: 'Tipo de emissão' },
    { tag: 'cDV', nome: 'Dígito verificador' },
    { tag: 'tpAmb', nome: 'Tipo de ambiente' },
    { tag: 'finNFe', nome: 'Finalidade da NFe' },
    { tag: 'indFinal', nome: 'Indicador de consumidor final' },
    { tag: 'indPres', nome: 'Indicador de presença' },
    { tag: 'procEmi', nome: 'Processo de emissão' },
    { tag: 'verProc', nome: 'Versão do processo' }
  ];

  camposObrigatorios.forEach(campo => {
    const regex = new RegExp(`<${campo.tag}>([^<]+)<\/${campo.tag}>`);
    const match = xmlEnviado.match(regex);
    const presente = match !== null;
    const valor = presente ? match[1] : 'N/A';
    
    console.log(`   ${presente ? '✅' : '❌'} ${campo.nome} (${campo.tag}): ${valor}`);
  });

  console.log('\n7️⃣ POSSÍVEIS SOLUÇÕES PARA ERRO 215:');
  console.log('===================================');
  
  console.log('1. 📝 Verificar encoding do XML (deve ser UTF-8)');
  console.log('2. 🔤 Verificar caracteres especiais nos campos de texto');
  console.log('3. 📅 Verificar formato exato da data/hora (timezone)');
  console.log('4. 🔢 Verificar se todos os campos numéricos têm formato correto');
  console.log('5. 📐 Verificar se campos decimais usam ponto (.) como separador');
  console.log('6. 🏷️  Verificar se não há tags vazias ou malformadas');
  console.log('7. 📦 Verificar ordem dos elementos XML');

  console.log('\n8️⃣ PRÓXIMOS PASSOS:');
  console.log('==================');
  console.log('1. 🛠️  Vamos criar uma versão simplificada do XML para teste');
  console.log('2. 📊 Comparar com um XML válido de exemplo');
  console.log('3. 🔧 Aplicar correções específicas baseadas no erro');
  console.log('4. 🧪 Testar novamente com validação extra');

  return {
    namespace: namespaceMatch ? namespaceMatch[1] : null,
    versao: versaoMatch ? versaoMatch[1] : null,
    modelo: modeloMatch ? modeloMatch[1] : null
  };
}

// Executar análise
try {
  const resultado = analisarSchemaXML();
  console.log('\n✅ Análise concluída!');
  console.log('📋 Dados extraídos:', resultado);
} catch (error) {
  console.error('❌ Erro na análise:', error.message);
}
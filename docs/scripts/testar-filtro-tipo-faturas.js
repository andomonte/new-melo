// Script para testar o filtro de tipo de faturas
// Execute no console do navegador para testar

async function testarFiltroTipoFaturas() {
  console.log('🧪 Testando filtro de tipo de faturas...');
  
  // Teste 1: Filtro NFS = 'S' (Autorizada)
  console.log('\n📋 Teste 1: Faturas Autorizadas (NFS = S)');
  try {
    const response1 = await fetch('/api/faturamento/listar-faturas?' + new URLSearchParams({
      page: '1',
      perPage: '5',
      filtros: JSON.stringify([
        { campo: 'nfs', tipo: 'igual', valor: 'S' }
      ])
    }));
    const data1 = await response1.json();
    console.log('✅ Resultado:', data1);
    console.log('📊 Total encontrado:', data1.meta?.total || 0);
  } catch (error) {
    console.error('❌ Erro no teste 1:', error);
  }
  
  // Teste 2: Filtro NFS = 'N' (Não autorizada)
  console.log('\n📋 Teste 2: Faturas Não Autorizadas (NFS = N)');
  try {
    const response2 = await fetch('/api/faturamento/listar-faturas?' + new URLSearchParams({
      page: '1',
      perPage: '5',
      filtros: JSON.stringify([
        { campo: 'nfs', tipo: 'igual', valor: 'N' }
      ])
    }));
    const data2 = await response2.json();
    console.log('✅ Resultado:', data2);
    console.log('📊 Total encontrado:', data2.meta?.total || 0);
  } catch (error) {
    console.error('❌ Erro no teste 2:', error);
  }
  
  // Teste 3: Filtro Agrupadas
  console.log('\n📋 Teste 3: Faturas Agrupadas');
  try {
    const response3 = await fetch('/api/faturamento/listar-faturas?' + new URLSearchParams({
      page: '1',
      perPage: '5',
      filtros: JSON.stringify([
        { campo: 'grupo_pagamento', tipo: 'nao_nulo', valor: '' }
      ])
    }));
    const data3 = await response3.json();
    console.log('✅ Resultado:', data3);
    console.log('📊 Total encontrado:', data3.meta?.total || 0);
  } catch (error) {
    console.error('❌ Erro no teste 3:', error);
  }
  
  // Teste 4: Filtro Individuais
  console.log('\n📋 Teste 4: Faturas Individuais');
  try {
    const response4 = await fetch('/api/faturamento/listar-faturas?' + new URLSearchParams({
      page: '1',
      perPage: '5',
      filtros: JSON.stringify([
        { campo: 'grupo_pagamento', tipo: 'nulo', valor: '' }
      ])
    }));
    const data4 = await response4.json();
    console.log('✅ Resultado:', data4);
    console.log('📊 Total encontrado:', data4.meta?.total || 0);
  } catch (error) {
    console.error('❌ Erro no teste 4:', error);
  }
  
  console.log('\n🎯 Testes concluídos! Verifique os logs acima.');
}

// Executar os testes
testarFiltroTipoFaturas();

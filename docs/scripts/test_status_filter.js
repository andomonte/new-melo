async function testStatusFilter() {
  console.log('\n🔍 Testando filtro de status...\n');
  
  const tests = [
    { status: 'pendente', label: 'PENDENTE' },
    { status: 'pago', label: 'PAGO' },
    { status: 'pago_parcial', label: 'PAGO PARCIAL' },
    { status: 'cancelado', label: 'CANCELADO' }
  ];
  
  for (const test of tests) {
    const url = `http://localhost:3000/api/contas-pagar?status=${test.status}&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n📋 Filtro: ${test.label}`);
    console.log(`   URL: ${url}`);
    console.log(`   Total encontrado: ${data.contas_pagar.length}`);
    
    if (data.contas_pagar.length > 0) {
      console.log('   Status retornados:');
      data.contas_pagar.forEach((c, i) => {
        console.log(`     ${i+1}. ID ${c.id}: status="${c.status}", cancel="${c.cancel}"`);
      });
      
      // Verificar se todos têm o status correto
      const todosCorretos = data.contas_pagar.every(c => c.status === test.status);
      console.log(`   ✓ Todos corretos: ${todosCorretos ? 'SIM ✅' : 'NÃO ❌'}`);
    }
  }
}

testStatusFilter().catch(console.error);

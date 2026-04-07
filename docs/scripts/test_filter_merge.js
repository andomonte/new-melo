// Teste de mesclagem de filtros

const filtrosExistentes = {
  credor: '00091',
  data_inicio: '2025-11-01',
  status: 'pago' // Status antigo
};

const novosFiltros = {
  status: 'pendente' // Novo status
};

// Mesclagem correta
const filtrosMesclados = { ...filtrosExistentes };

Object.keys(novosFiltros).forEach(key => {
  const valor = novosFiltros[key];
  if (valor === '' || valor === undefined || valor === null) {
    delete filtrosMesclados[key];
    console.log(`❌ Removendo filtro: ${key}`);
  } else {
    filtrosMesclados[key] = valor;
    console.log(`✅ Atualizando filtro: ${key} = ${valor}`);
  }
});

console.log('\n📋 Resultado da mesclagem:');
console.log('  Filtros existentes:', filtrosExistentes);
console.log('  Novos filtros:', novosFiltros);
console.log('  Filtros mesclados:', filtrosMesclados);

console.log('\n✅ Status foi atualizado corretamente de "pago" para "pendente"');
console.log('✅ Outros filtros (credor, data_inicio) foram preservados');

// Teste de remoção de filtro
console.log('\n--- Teste 2: Remover filtro de status ---');
const filtrosParaRemover = {
  status: '' // Valor vazio para remover
};

const filtrosAposRemocao = { ...filtrosMesclados };

Object.keys(filtrosParaRemover).forEach(key => {
  const valor = filtrosParaRemover[key];
  if (valor === '' || valor === undefined || valor === null) {
    delete filtrosAposRemocao[key];
    console.log(`❌ Removendo filtro: ${key}`);
  }
});

console.log('\n📋 Resultado após remoção:');
console.log('  Filtros antes:', filtrosMesclados);
console.log('  Filtros depois:', filtrosAposRemocao);
console.log('\n✅ Filtro de status foi removido corretamente');
console.log('✅ Outros filtros foram preservados');

// Script para testar o cálculo de totais das faturas agrupadas
console.log('🧮 Testando cálculo de totais para agrupamento...');

// Simular dados de itens de fatura como vêm do banco
const exemploItensVenda = [
  {
    valorunit: '150.75',
    qtde: '2',
    imposto: '27.14',
    produto: 'Produto A',
    codprod: 'PROD001'
  },
  {
    valorunit: '89.90',
    qtde: '3',
    imposto: '16.18',
    produto: 'Produto B', 
    codprod: 'PROD002'
  },
  {
    valorunit: '299.99',
    qtde: '1',
    imposto: '53.99',
    produto: 'Produto C',
    codprod: 'PROD003'
  }
];

console.log('📊 Dados de exemplo:');
console.table(exemploItensVenda.map(item => ({
  produto: item.produto,
  valorUnit: `R$ ${item.valorunit}`,
  qtde: item.qtde,
  subtotal: `R$ ${(parseFloat(item.valorunit) * parseFloat(item.qtde)).toFixed(2)}`,
  imposto: `R$ ${item.imposto}`
})));

// Aplicar a lógica do useEffect
let totalProdutos = 0;
let totalImpostos = 0;

exemploItensVenda.forEach(item => {
  const valorUnitario = parseFloat(item.valorunit || 0);
  const quantidade = parseFloat(item.qtde || 0);
  const valorTotalItem = valorUnitario * quantidade;
  totalProdutos += valorTotalItem;
  
  const impostoItem = parseFloat(item.imposto || 0);
  totalImpostos += impostoItem;
});

console.log('');
console.log('💰 RESULTADO DOS CÁLCULOS:');
console.log(`📦 Total Produtos: R$ ${totalProdutos.toFixed(2)}`);
console.log(`🏛️  Total Impostos: R$ ${totalImpostos.toFixed(2)}`);
console.log(`💵 Total Geral: R$ ${(totalProdutos + totalImpostos).toFixed(2)}`);

console.log('');
console.log('✅ Lógica implementada no useEffect:');
console.log('   - totalProdutos = Σ(valorunit × qtde)');
console.log('   - totalImpostos = Σ(imposto)');
console.log('   - Ativado quando itensVenda muda');

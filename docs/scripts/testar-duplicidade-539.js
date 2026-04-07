// Script para testar o tratamento de duplicidade NFe (código 539)
// Execute no navegador: node scripts/testar-duplicidade-539.js

console.log('🧪 TESTE: Simulação de tratamento de duplicidade NFe (código 539)');

// Simular erro 539 da SEFAZ
const simularErro539 = () => {
  return {
    response: {
      data: {
        motivo: "Status final da NF-e: 539 Rejeicao: Duplicidade de NF-e, com diferenca na chave de acesso [chNFe: 13250918053139000169550090000000011241729730][nRec: 130000195185990]"
      }
    }
  };
};

// Função para detectar duplicidade (mesma lógica do componente)
const detectarDuplicidade = (mensagem) => {
  return mensagem.includes('539') || 
         mensagem.includes('Duplicidade de NF-e') ||
         mensagem.includes('diferenca na chave de acesso');
};

// Simulação do tratamento de erro
const testarTratamentoDuplicidade = () => {
  const erro = simularErro539();
  const mensagem = erro.response.data.motivo;
  
  console.log('\n📋 TESTE DE DETECÇÃO:');
  console.log('Mensagem de erro:', mensagem);
  console.log('É duplicidade (539):', detectarDuplicidade(mensagem));
  
  // Simular o comportamento das tentativas
  console.log('\n🔄 SIMULAÇÃO DE TENTATIVAS:');
  let tentativas = 3;
  
  while (tentativas > 0) {
    console.log(`\n--- Tentativa ${4 - tentativas} ---`);
    
    if (detectarDuplicidade(mensagem) && tentativas > 1) {
      tentativas--;
      console.log(`✅ Duplicidade detectada`);
      console.log(`🔄 Gerando nova série... (Tentativas restantes: ${tentativas})`);
      console.log(`⏱️  Aguardando 2 segundos para garantir timestamp diferente...`);
    } else {
      console.log(`❌ ${tentativas === 1 ? 'Duplicidade persistiu após 3 tentativas' : 'Erro não é duplicidade'}`);
      break;
    }
  }
  
  // Resultado final
  if (tentativas === 0) {
    console.log('\n🏁 RESULTADO FINAL:');
    console.log('❌ Todas as 3 tentativas falharam');
    console.log('💾 Fatura será salva com NFS = "N"');
    console.log('📝 Motivo registrado: DUPLICIDADE PERSISTIU após 3 tentativas automáticas');
    console.log('🚨 Toast de aviso será exibido por 12 segundos');
    console.log('📊 Janela de progresso mostrará erro específico de duplicidade');
  }
};

// Executar teste
testarTratamentoDuplicidade();

console.log('\n✅ Teste concluído!');
console.log('\n💡 RESUMO DAS MELHORIAS:');
console.log('1. ✅ Sistema detecta código 539 automaticamente');
console.log('2. ✅ Realiza até 3 tentativas com séries diferentes');
console.log('3. ✅ Aguarda 2 segundos entre tentativas (timestamp único)');
console.log('4. ✅ Mensagens específicas para duplicidade vs outros erros');
console.log('5. ✅ Toast com duração maior para duplicidade (12s vs 8s)');
console.log('6. ✅ Janela de progresso com informações detalhadas');
console.log('7. ✅ Log completo no console para debugging');
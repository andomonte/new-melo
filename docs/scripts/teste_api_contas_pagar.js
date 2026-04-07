const fetch = global.fetch;

async function testarAPIContasPagar() {
  console.log('🚀 [Teste API] Testando listagem de contas a pagar...');

  try {
    const response = await fetch('http://localhost:3000/api/contas-pagar?page=1&limit=10');

    if (!response.ok) {
      console.error('❌ [Teste API] Erro na API:', response.status);
      return;
    }

    const data = await response.json();

    console.log('✅ [Teste API] Contas encontradas:', data.contas_pagar.length);

    // Procurar pelo título de teste
    const tituloTeste = data.contas_pagar.find((conta) => conta.id === '000027617');

    if (tituloTeste) {
      console.log('🎯 [Teste API] Título de teste encontrado:');
      console.log('   Todos os campos:', Object.keys(tituloTeste));
      console.log('   ID:', tituloTeste.id);
      console.log('   Tipo:', tituloTeste.tipo);
      console.log('   Valor:', tituloTeste.valor_pgto);
      console.log('   Título Importado:', tituloTeste.titulo_importado, 'Type:', typeof tituloTeste.titulo_importado);
      console.log('   Status:', tituloTeste.status);
      console.log('   Observação:', tituloTeste.obs);
    } else {
      console.log('❌ [Teste API] Título de teste NÃO encontrado na listagem');
      console.log('📋 [Teste API] Primeiras contas encontradas:');
      data.contas_pagar.slice(0, 3).forEach((conta, index) => {
        console.log(`${index + 1}. ${conta.id} - ${conta.nome_credor || conta.cod_transp} - R$ ${conta.valor_pgto} - Importado: ${conta.titulo_importado}`);
      });
    }

  } catch (error) {
    console.error('❌ [Teste API] Erro:', error);
  }
}

testarAPIContasPagar();
// Teste da API de notas associadas
const fetch = global.fetch;

async function testarAPINotasAssociadas(codPgto) {
  console.log(`🚀 [Teste API] Testando consulta de notas associadas ao título ${codPgto}...`);

  try {
    const response = await fetch(`http://localhost:3000/api/contas-pagar/notas-associadas?cod_pgto=${codPgto}`);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Teste API] Erro na API:', data);
      return;
    }

    console.log('✅ [Teste API] Consulta realizada com sucesso!');
    console.log('📄 [Teste API] Informações do título:');
    console.log(`   Código: ${data.titulo.cod_pgto}`);
    console.log(`   Tipo: ${data.titulo.tipo}`);
    console.log(`   Transportadora: ${data.titulo.cod_transp}`);
    console.log(`   Valor: R$ ${data.titulo.valor_pgto}`);
    console.log(`   Importado: ${data.titulo.titulo_importado}`);
    console.log(`   Observação: ${data.titulo.obs}`);
    console.log('---');

    console.log(`📋 [Teste API] Notas associadas (${data.notas.length}):`);
    data.notas.forEach((nota, index) => {
      console.log(`${index + 1}. CT-e: ${nota.codtransp}-${nota.nrocon}`);
      console.log(`   Transportadora: ${nota.nome_transportadora}`);
      console.log(`   Valor: R$ ${nota.totaltransp}`);
      console.log(`   Pago: ${nota.pago}`);
      if (nota.dtemissao) {
        console.log(`   Emissão: ${nota.dtemissao}`);
      }
      if (nota.chave) {
        console.log(`   Chave: ${nota.chave}`);
      }
      console.log('---');
    });

    console.log('📊 [Teste API] Resumo:');
    console.log(`   Quantidade de notas: ${data.resumo.quantidade_notas}`);
    console.log(`   Valor total das notas: R$ ${data.resumo.valor_total_notas}`);
    console.log(`   Valor do título: R$ ${data.resumo.valor_titulo}`);
    console.log(`   Valores conferem: ${data.resumo.valores_conferem ? '✅ Sim' : '❌ Não'}`);
    if (!data.resumo.valores_conferem) {
      console.log(`   Diferença: R$ ${data.resumo.diferenca}`);
    }

  } catch (error) {
    console.error('❌ [Teste API] Erro:', error.message);
  }
}

// Usar o título que geramos no teste anterior
testarAPINotasAssociadas('000027617');
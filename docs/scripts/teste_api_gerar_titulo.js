// Usar fetch nativo do Node.js (v18+)
const fetch = global.fetch;

async function testarGeracaoTitulo() {
  console.log('🚀 [Teste API] Testando geração de título de CT-e...');

  try {
    // Dados de teste para gerar um título (usando CT-e real)
    const dadosTeste = {
      cod_transp: '00006', // ITAPEMIRIM TRANSPORTES
      cod_conta: '0001',  // Conta contábil de teste
      cod_ccusto: '0001', // Centro de custo de teste
      cod_comprador: '001', // Comprador de teste
      dt_venc: '2025-12-15', // Data de vencimento
      obs: 'Teste de geração automática de título CT-e',
      notas: [
        {
          codtransp: '00006',
          nrocon: '000992274'
        }
      ]
    };

    console.log('📤 [Teste API] Enviando dados:', JSON.stringify(dadosTeste, null, 2));

    const response = await fetch('http://localhost:3000/api/notas-conhecimento/gerar-titulo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dadosTeste),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Teste API] Erro na API:', data);
      return;
    }

    console.log('✅ [Teste API] Título gerado com sucesso!');
    console.log('📄 [Teste API] Resposta:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ [Teste API] Erro:', error.message);
  }
}

// Executar teste
testarGeracaoTitulo();
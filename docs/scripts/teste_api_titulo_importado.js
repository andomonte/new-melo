async function testTituloImportadoAPI() {
  try {
    console.log('🧪 Testando API de criação de conta com notas_conhecimento...');

    const response = await fetch('http://localhost:3000/api/contas-pagar/criar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: 'T',
        cod_transp: '00001',
        cod_conta: '0001',
        dt_venc: '2025-12-01',
        valor_pgto: 100.00,
        obs: 'Teste titulo_importado',
        notas_conhecimento: [
          {
            codtransp: '00001',
            nrocon: '000012345',
            valor: 100.00
          }
        ]
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Conta criada com sucesso:', result);
    } else {
      console.log('❌ Erro na criação:', result);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

testTituloImportadoAPI();
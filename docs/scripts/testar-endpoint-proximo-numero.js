const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
async function testarEndpoint() {
  console.log('🧪 Testando endpoint /api/faturamento/obter-proximo-numero-nfe\n');

  const testes = [
    { serie: '2', numeroAtual: '1', descricao: 'Série 2 (já tem número 1)' },
    { serie: '3', numeroAtual: '1', descricao: 'Série 3 (já tem número 1)' },
    { serie: '5', numeroAtual: '1', descricao: 'Série 5 (já tem número 1 e 1123)' },
    { serie: '7', numeroAtual: '1', descricao: 'Série 7 (já tem número 1)' },
    { serie: '9', numeroAtual: '1', descricao: 'Série 9 (ainda não tem NFes)' },
  ];

  for (const teste of testes) {
    try {
      console.log(`📋 Testando: ${teste.descricao}`);
      console.log(`   Entrada: série=${teste.serie}, numeroAtual=${teste.numeroAtual}`);
      
      const response = await axios.post('http://localhost:3000/api/faturamento/obter-proximo-numero-nfe', {
        serie: teste.serie,
        numeroAtual: teste.numeroAtual,
      });

      if (response.data?.sucesso) {
        console.log(`   ✅ Próximo número: ${response.data.proximoNumero}`);
        if (response.data.numerosUsados?.length > 0) {
          console.log(`   📊 Números já usados: ${response.data.numerosUsados.join(', ')}`);
        }
      } else {
        console.log(`   ❌ Erro: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`   ❌ Erro HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('✅ Testes concluídos!');
}

testarEndpoint();

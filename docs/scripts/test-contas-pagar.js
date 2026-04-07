
const https = require('https');
const http = require('http');

async function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(data))
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

async function testarAPIContasPagar() {
  try {
    console.log('🧪 Testando API de Contas a Pagar...\n');

    // Teste básico
    const response = await fetch('http://localhost:3000/api/contas-pagar?page=1&limit=5');

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    console.log('✅ API funcionando!');
    console.log(`📊 Total de registros: ${data.paginacao?.total || 'N/A'}`);
    console.log(`📄 Página atual: ${data.paginacao?.pagina || 'N/A'}`);
    console.log(`📋 Registros retornados: ${data.contas_pagar?.length || 0}`);

    if (data.contas_pagar && data.contas_pagar.length > 0) {
      console.log('\n📝 Primeiros registros:');
      data.contas_pagar.slice(0, 3).forEach((conta, index) => {
        console.log(`${index + 1}. ID: ${conta.id} | Credor: ${conta.nome_credor} | Valor: R$ ${conta.valor_pgto} | Status: ${conta.status}`);
      });
    }

    // Teste com filtros
    console.log('\n🔍 Testando filtros...');
    const responseFiltrado = await fetch('http://localhost:3000/api/contas-pagar?page=1&limit=5&status=pendente');

    if (responseFiltrado.ok) {
      const dataFiltrada = await responseFiltrado.json();
      console.log(`✅ Filtro funcionando! Registros pendentes: ${dataFiltrada.contas_pagar?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  testarAPIContasPagar();
}

module.exports = { testarAPIContasPagar };
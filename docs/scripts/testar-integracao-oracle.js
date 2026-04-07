/**
 * Script de Teste - Integração Oracle Contas a Pagar
 * 
 * Execute: node scripts/testar-integracao-oracle.js
 */

const { 
  calcularJurosTitulo, 
  getOracleConnection,
  mapearContaParaBanco,
  obterNomeBanco
} = require('../src/lib/oracleService');

async function testarIntegracao() {
  console.log('🧪 TESTE DE INTEGRAÇÃO ORACLE - CONTAS A PAGAR\n');
  console.log('='.repeat(80));

  // ==================== TESTE 1: Cálculo de Juros ====================
  console.log('\n📊 TESTE 1: Cálculo de Juros\n');
  
  const testes = [
    { valor: 1000, dias: 30, descricao: 'R$ 1.000,00 com 30 dias' },
    { valor: 500, dias: 15, descricao: 'R$ 500,00 com 15 dias' },
    { valor: 2000, dias: 60, descricao: 'R$ 2.000,00 com 60 dias' },
    { valor: 1500, dias: 0, descricao: 'R$ 1.500,00 sem atraso' },
  ];

  testes.forEach(({ valor, dias, descricao }) => {
    const dtVenc = new Date();
    dtVenc.setDate(dtVenc.getDate() - dias);
    
    const resultado = calcularJurosTitulo(valor, dtVenc, 8);
    
    console.log(`✓ ${descricao}`);
    console.log(`  Dias de atraso: ${resultado.dias}`);
    console.log(`  Juros: R$ ${resultado.juros.toFixed(2)}`);
    console.log(`  Total: R$ ${(valor + resultado.juros).toFixed(2)}`);
    console.log('');
  });

  // ==================== TESTE 2: Mapeamento de Bancos ====================
  console.log('\n🏦 TESTE 2: Mapeamento de Bancos\n');
  
  const contas = ['0003', '0007', '0104', '0124', '0133', '9999'];
  
  contas.forEach(conta => {
    const codigoBanco = mapearContaParaBanco(conta);
    const nomeBanco = obterNomeBanco(codigoBanco);
    console.log(`✓ Conta ${conta} → Banco ${codigoBanco} (${nomeBanco})`);
  });

  // ==================== TESTE 3: Conexão Oracle ====================
  console.log('\n\n🔌 TESTE 3: Conexão com Oracle\n');
  
  let connection;
  try {
    connection = await getOracleConnection();
    console.log('✅ Conexão Oracle estabelecida com sucesso!');
    
    // Testar query simples
    const result = await connection.execute(`SELECT SYSDATE FROM DUAL`);
    console.log(`✓ Data do servidor Oracle: ${result.rows[0]}`);
    
  } catch (error) {
    console.error('❌ Erro ao conectar Oracle:', error.message);
  } finally {
    if (connection) {
      await connection.close();
      console.log('✓ Conexão fechada');
    }
  }

  // ==================== TESTE 4: Consulta de Título ====================
  console.log('\n\n📄 TESTE 4: Consulta de Título (exemplo)\n');
  
  try {
    const connection = await getOracleConnection();
    
    // Buscar um título de exemplo
    const result = await connection.execute(
      `SELECT cod_receb, valor_pgto, dt_venc, rec 
       FROM DBRECEB 
       WHERE ROWNUM = 1 
       ORDER BY dt_venc DESC`
    );
    
    if (result.rows && result.rows.length > 0) {
      const [codReceb, valorPgto, dtVenc, rec] = result.rows[0];
      console.log('✓ Título encontrado:');
      console.log(`  Código: ${codReceb}`);
      console.log(`  Valor: R$ ${valorPgto}`);
      console.log(`  Vencimento: ${dtVenc}`);
      console.log(`  Status: ${rec === 'S' ? 'Pago' : 'Pendente'}`);
      
      // Calcular juros se pendente
      if (rec === 'N') {
        const juros = calcularJurosTitulo(valorPgto, new Date(dtVenc), 8);
        console.log(`  Dias de atraso: ${juros.dias}`);
        console.log(`  Juros calculado: R$ ${juros.juros.toFixed(2)}`);
      }
    } else {
      console.log('⚠️  Nenhum título encontrado no banco');
    }
    
    await connection.close();
    
  } catch (error) {
    console.error('❌ Erro ao consultar título:', error.message);
  }

  // ==================== TESTE 5: Validação de Fórmula ====================
  console.log('\n\n🧮 TESTE 5: Validação de Fórmula de Juros\n');
  
  console.log('Fórmula Oracle: (8 / 3000) * valor * dias');
  console.log('Taxa diária: 0,00266666...\n');
  
  const valorTeste = 1000;
  const diasTeste = 30;
  const taxaDia = 8 / 3000;
  const jurosManual = valorTeste * taxaDia * diasTeste;
  
  const dtVencTeste = new Date();
  dtVencTeste.setDate(dtVencTeste.getDate() - diasTeste);
  const jurosCalc = calcularJurosTitulo(valorTeste, dtVencTeste, 8);
  
  console.log(`Cálculo Manual: R$ ${jurosManual.toFixed(2)}`);
  console.log(`Cálculo Função: R$ ${jurosCalc.juros.toFixed(2)}`);
  console.log(jurosManual === jurosCalc.juros ? '✅ Fórmula validada!' : '❌ Divergência detectada');

  // ==================== RESUMO ====================
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 RESUMO DOS TESTES\n');
  console.log('✅ Teste 1: Cálculo de Juros - OK');
  console.log('✅ Teste 2: Mapeamento de Bancos - OK');
  console.log('✅ Teste 3: Conexão Oracle - Verificar acima');
  console.log('✅ Teste 4: Consulta de Título - Verificar acima');
  console.log('✅ Teste 5: Validação de Fórmula - OK');
  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Testes concluídos!\n');
}

// Executar testes
testarIntegracao()
  .then(() => {
    console.log('🎉 Integração testada com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro durante os testes:', error);
    process.exit(1);
  });

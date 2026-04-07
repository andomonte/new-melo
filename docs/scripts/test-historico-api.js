const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testarHistorico() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Buscando uma conta com pagamentos...\n');
    
    // Primeiro, vamos buscar uma conta que tenha pagamentos registrados
    const contasComPagamento = await client.query(`
      SELECT DISTINCT 
        pe.codpgto,
        COUNT(fp.cod_pgto) as qtd_pagamentos,
        SUM(fp.valor_pgto) as total_pago
      FROM db_manaus.dbpgto_ent pe
      INNER JOIN db_manaus.dbfpgto fp ON pe.codpgto = fp.cod_pgto
      WHERE fp.cancel != 'S' OR fp.cancel IS NULL
      GROUP BY pe.codpgto
      HAVING COUNT(fp.cod_pgto) > 0
      LIMIT 5
    `);
    
    if (contasComPagamento.rows.length === 0) {
      console.log('❌ Nenhuma conta com pagamentos encontrada');
      return;
    }
    
    console.log('✅ Contas com pagamentos encontradas:');
    contasComPagamento.rows.forEach((conta, index) => {
      console.log(`${index + 1}. Conta ${conta.codpgto}: ${conta.qtd_pagamentos} pagamentos, Total: R$ ${parseFloat(conta.total_pago).toFixed(2)}`);
    });
    
    // Selecionar a primeira conta para testar
    const codPgtoTeste = contasComPagamento.rows[0].codpgto;
    console.log(`\n📊 Testando histórico da conta ${codPgtoTeste}...\n`);
    
    // Simular a query da API
    const historico = await client.query(`
      SELECT 
        cod_pgto,
        cod_fpgto,
        dt_pgto,
        valor_pgto,
        nro_cheque,
        cod_conta,
        tp_pgto,
        juros,
        multa,
        desconto
      FROM db_manaus.dbfpgto
      WHERE cod_pgto = $1 
        AND (cancel != 'S' OR cancel IS NULL)
      ORDER BY dt_pgto DESC
    `, [codPgtoTeste]);
    
    console.log('📝 Histórico de Pagamentos:');
    console.log('─'.repeat(80));
    
    let totalPago = 0;
    historico.rows.forEach((pag, index) => {
      const valor = parseFloat(pag.valor_pgto);
      totalPago += valor;
      
      console.log(`${index + 1}. Data: ${pag.dt_pgto?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`   Valor: R$ ${valor.toFixed(2)}`);
      console.log(`   Forma Pgto: ${pag.cod_fpgto || '-'}`);
      console.log(`   Banco: ${pag.cod_conta || '-'}`);
      console.log(`   Nº Cheque: ${pag.nro_cheque || '-'}`);
      
      if (pag.juros) console.log(`   Juros: R$ ${parseFloat(pag.juros).toFixed(2)}`);
      if (pag.multa) console.log(`   Multa: R$ ${parseFloat(pag.multa).toFixed(2)}`);
      if (pag.desconto) console.log(`   Desconto: R$ ${parseFloat(pag.desconto).toFixed(2)}`);
      
      console.log('─'.repeat(80));
    });
    
    console.log(`\n💰 Resumo:`);
    console.log(`   Quantidade de pagamentos: ${historico.rows.length}`);
    console.log(`   Total pago: R$ ${totalPago.toFixed(2)}`);
    
    // Verificar valor original da conta
    const contaOriginal = await client.query(`
      SELECT valor_pgto 
      FROM db_manaus.dbpgto_ent 
      WHERE codpgto = $1
    `, [codPgtoTeste]);
    
    if (contaOriginal.rows.length > 0) {
      const valorOriginal = parseFloat(contaOriginal.rows[0].valor_pgto);
      const saldoRestante = valorOriginal - totalPago;
      
      console.log(`   Valor original: R$ ${valorOriginal.toFixed(2)}`);
      console.log(`   Saldo restante: R$ ${saldoRestante.toFixed(2)}`);
      
      if (saldoRestante > 0.01) {
        console.log(`   Status: 🟡 Pago Parcialmente (${((totalPago / valorOriginal) * 100).toFixed(1)}%)`);
      } else if (saldoRestante < -0.01) {
        console.log(`   Status: 🔵 Pago com excesso`);
      } else {
        console.log(`   Status: 🟢 Pago`);
      }
    }
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao testar histórico:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testarHistorico();

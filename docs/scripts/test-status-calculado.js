const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testarCalculoStatus() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testando cálculo de status de pagamentos...\n');
    
    // Buscar contas com diferentes situações de pagamento
    const query = `
      WITH contas_com_status AS (
        SELECT
          p.cod_pgto as id,
          c.nome as nome_credor,
          p.valor_pgto,
          COALESCE(
            (SELECT SUM(f.valor_pgto) 
             FROM db_manaus.dbfpgto f 
             WHERE f.cod_pgto = p.cod_pgto 
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) as total_pago_historico,
          p.paga as campo_paga,
          p.cancel,
          CASE
            WHEN p.cancel = 'S' THEN 'cancelado'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) >= p.valor_pgto THEN 'pago'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) > 0 THEN 'pago_parcial'
            ELSE 'pendente'
          END as status_calculado
        FROM dbpgto p
        LEFT JOIN dbcredor c ON c.cod_credor = p.cod_credor
        WHERE p.cancel != 'S' OR p.cancel IS NULL
        ORDER BY p.cod_pgto DESC
        LIMIT 20
      )
      SELECT * FROM contas_com_status
    `;
    
    const result = await client.query(query);
    
    console.log('📊 Contas encontradas:\n');
    console.log('─'.repeat(120));
    
    let countPendente = 0;
    let countParcial = 0;
    let countPago = 0;
    
    result.rows.forEach((conta, index) => {
      const valorOriginal = parseFloat(conta.valor_pgto);
      const totalPago = parseFloat(conta.total_pago_historico);
      const percentual = valorOriginal > 0 ? (totalPago / valorOriginal) * 100 : 0;
      
      let statusEmoji = '';
      if (conta.status_calculado === 'pendente') {
        statusEmoji = '🟡';
        countPendente++;
      } else if (conta.status_calculado === 'pago_parcial') {
        statusEmoji = '🔵';
        countParcial++;
      } else if (conta.status_calculado === 'pago') {
        statusEmoji = '🟢';
        countPago++;
      }
      
      console.log(`${index + 1}. ${statusEmoji} Conta ${conta.id} - ${conta.nome_credor || 'Sem nome'}`);
      console.log(`   Valor Original: R$ ${valorOriginal.toFixed(2)}`);
      console.log(`   Total Pago: R$ ${totalPago.toFixed(2)} (${percentual.toFixed(1)}%)`);
      console.log(`   Saldo: R$ ${(valorOriginal - totalPago).toFixed(2)}`);
      console.log(`   Campo 'paga': ${conta.campo_paga}`);
      console.log(`   Status Calculado: ${conta.status_calculado.toUpperCase()}`);
      console.log('─'.repeat(120));
    });
    
    console.log(`\n📈 Resumo:`);
    console.log(`   🟡 Pendente: ${countPendente}`);
    console.log(`   🔵 Pago Parcialmente: ${countParcial}`);
    console.log(`   🟢 Pago: ${countPago}`);
    console.log(`   📊 Total: ${result.rows.length}`);
    
    // Testar filtro por status
    console.log('\n\n🔎 Testando filtro por status "pago_parcial"...\n');
    
    const queryParcial = `
      WITH contas_com_status AS (
        SELECT
          p.cod_pgto as id,
          c.nome as nome_credor,
          CASE
            WHEN p.cancel = 'S' THEN 'cancelado'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) >= p.valor_pgto THEN 'pago'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) > 0 THEN 'pago_parcial'
            ELSE 'pendente'
          END as status
        FROM dbpgto p
        LEFT JOIN dbcredor c ON c.cod_credor = p.cod_credor
      )
      SELECT * FROM contas_com_status
      WHERE status = 'pago_parcial'
      LIMIT 10
    `;
    
    const resultParcial = await client.query(queryParcial);
    
    console.log(`✅ Encontradas ${resultParcial.rows.length} contas com status "pago_parcial"`);
    resultParcial.rows.forEach((conta, index) => {
      console.log(`   ${index + 1}. Conta ${conta.id} - ${conta.nome_credor || 'Sem nome'}`);
    });
    
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testarCalculoStatus();

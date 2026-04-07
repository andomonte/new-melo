const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testarParcelas() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Buscando contas parceladas...\n');
    
    // Buscar contas com nro_dup contendo "/"
    const contasParceladas = await client.query(`
      SELECT 
        cod_pgto,
        nro_dup,
        cod_credor,
        cod_transp,
        tipo,
        valor_pgto,
        dt_venc
      FROM dbpgto
      WHERE nro_dup LIKE '%/%'
        AND (cancel != 'S' OR cancel IS NULL)
      ORDER BY nro_dup
      LIMIT 20
    `);
    
    if (contasParceladas.rows.length === 0) {
      console.log('❌ Nenhuma conta parcelada encontrada no formato esperado (nro_dup com "/")');
      return;
    }
    
    console.log(`✅ ${contasParceladas.rows.length} contas parceladas encontradas:\n`);
    
    // Agrupar por prefixo do nro_dup
    const grupos = {};
    contasParceladas.rows.forEach(conta => {
      const prefixo = conta.nro_dup.split('/')[0];
      if (!grupos[prefixo]) {
        grupos[prefixo] = [];
      }
      grupos[prefixo].push(conta);
    });
    
    // Mostrar grupos
    console.log('📦 Grupos de parcelas encontrados:\n');
    Object.keys(grupos).forEach((prefixo, index) => {
      const parcelas = grupos[prefixo];
      console.log(`${index + 1}. Prefixo: ${prefixo}`);
      console.log(`   Parcelas: ${parcelas.length}x`);
      console.log(`   Credor: ${parcelas[0].cod_credor || parcelas[0].cod_transp}`);
      console.log(`   Total: R$ ${parcelas.reduce((sum, p) => sum + parseFloat(p.valor_pgto), 0).toFixed(2)}`);
      parcelas.forEach((p, i) => {
        console.log(`   - ${p.nro_dup}: R$ ${parseFloat(p.valor_pgto).toFixed(2)} (Venc: ${p.dt_venc?.toISOString().split('T')[0]})`);
      });
      console.log('');
    });
    
    // Testar com a primeira conta
    const primeiraGrupo = Object.keys(grupos)[0];
    const primeirasConta = grupos[primeiraGrupo][0];
    
    console.log(`\n📊 Testando busca de parcelas para conta ${primeirasConta.cod_pgto}...\n`);
    
    const prefixoDup = primeirasConta.nro_dup.split('/')[0];
    
    // Simular a query da API
    const queryParcelas = primeirasConta.tipo === 'F'
      ? `SELECT 
           p.cod_pgto,
           p.nro_dup,
           p.dt_venc,
           p.valor_pgto,
           p.paga,
           p.dt_pgto,
           p.valor_pago
         FROM dbpgto p
         WHERE p.nro_dup LIKE $1
           AND p.cod_credor = $2
           AND p.tipo = 'F'
           AND (p.cancel != 'S' OR p.cancel IS NULL)
         ORDER BY p.nro_dup`
      : `SELECT 
           p.cod_pgto,
           p.nro_dup,
           p.dt_venc,
           p.valor_pgto,
           p.paga,
           p.dt_pgto,
           p.valor_pago
         FROM dbpgto p
         WHERE p.nro_dup LIKE $1
           AND p.cod_transp = $2
           AND p.tipo = 'T'
           AND (p.cancel != 'S' OR p.cancel IS NULL)
         ORDER BY p.nro_dup`;

    const resultParcelas = await client.query(
      queryParcelas,
      [`${prefixoDup}/%`, primeirasConta.tipo === 'F' ? primeirasConta.cod_credor : primeirasConta.cod_transp]
    );
    
    console.log('📝 Parcelas encontradas:');
    console.log('─'.repeat(80));
    
    let totalGeral = 0;
    let totalPagoGeral = 0;
    
    for (const [index, parcela] of resultParcelas.rows.entries()) {
      // Buscar histórico de pagamentos
      const historico = await client.query(
        `SELECT COALESCE(SUM(valor_pgto), 0) as total_pago
         FROM db_manaus.dbfpgto
         WHERE cod_pgto = $1 
           AND (cancel != 'S' OR cancel IS NULL)`,
        [parcela.cod_pgto]
      );
      
      const totalPago = parseFloat(historico.rows[0]?.total_pago || '0');
      const valorOriginal = parseFloat(parcela.valor_pgto);
      totalGeral += valorOriginal;
      totalPagoGeral += totalPago;
      
      // Determinar status
      let status = '🟡 Pendente';
      if (totalPago >= valorOriginal - 0.01) {
        status = '🟢 Pago';
      } else if (totalPago > 0) {
        status = '🔵 Pago Parcialmente';
      }
      
      console.log(`${index + 1}. ${parcela.nro_dup}`);
      console.log(`   Código: ${parcela.cod_pgto}`);
      console.log(`   Vencimento: ${parcela.dt_venc?.toISOString().split('T')[0]}`);
      console.log(`   Valor: R$ ${valorOriginal.toFixed(2)}`);
      console.log(`   Pago: R$ ${totalPago.toFixed(2)}`);
      console.log(`   Status: ${status}`);
      console.log('─'.repeat(80));
    }
    
    console.log(`\n💰 Resumo do Grupo "${prefixoDup}":`);
    console.log(`   Total de parcelas: ${resultParcelas.rows.length}`);
    console.log(`   Valor total: R$ ${totalGeral.toFixed(2)}`);
    console.log(`   Total pago: R$ ${totalPagoGeral.toFixed(2)}`);
    console.log(`   Saldo restante: R$ ${(totalGeral - totalPagoGeral).toFixed(2)}`);
    console.log(`   Progresso: ${((totalPagoGeral / totalGeral) * 100).toFixed(1)}%`);
    
    const parcelasPagas = resultParcelas.rows.filter(p => {
      const totalPago = parseFloat(p.valor_pago || '0');
      const valorOriginal = parseFloat(p.valor_pgto);
      return totalPago >= valorOriginal - 0.01;
    }).length;
    
    console.log(`   Parcelas pagas: ${parcelasPagas} de ${resultParcelas.rows.length}`);
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao testar parcelas:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testarParcelas();

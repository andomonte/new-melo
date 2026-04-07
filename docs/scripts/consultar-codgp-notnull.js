require('dotenv').config();
const { Pool } = require('pg');

async function consultarFaturasAgrupadas() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Consultando faturas onde codgp não é null...\n');
    
    // Consulta básica
    const result = await client.query(`
      SELECT 
        codfat,
        nroform,
        data,
        totalnf,
        codgp,
        agp,
        codcli,
        nfs,
        cancel
      FROM dbfatura 
      WHERE codgp IS NOT NULL
      ORDER BY codgp, data DESC;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma fatura com codgp encontrada');
    } else {
      console.log(`✅ Encontradas ${result.rows.length} faturas agrupadas:\n`);
      
      console.log('CODFAT'.padEnd(10) + 'NROFORM'.padEnd(12) + 'DATA'.padEnd(12) + 'TOTAL'.padEnd(12) + 'CODGP'.padEnd(8) + 'AGP'.padEnd(5) + 'CLIENTE'.padEnd(8) + 'NFS'.padEnd(5) + 'CANCEL');
      console.log('-'.repeat(80));
      
      result.rows.forEach(row => {
        const data = row.data ? new Date(row.data).toLocaleDateString('pt-BR') : 'N/A';
        const total = row.totalnf ? parseFloat(row.totalnf).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '0,00';
        
        console.log(
          (row.codfat || '').toString().padEnd(10) +
          (row.nroform || '').toString().padEnd(12) +
          data.padEnd(12) +
          ('R$ ' + total).padEnd(12) +
          (row.codgp || '').toString().padEnd(8) +
          (row.agp || '').toString().padEnd(5) +
          (row.codcli || '').toString().padEnd(8) +
          (row.nfs || '').toString().padEnd(5) +
          (row.cancel || '').toString()
        );
      });
    }
    
    // Consulta agrupada
    console.log('\n📊 Resumo por grupo de pagamento:\n');
    
    const groupResult = await client.query(`
      SELECT 
        codgp,
        COUNT(*) as quantidade_faturas,
        SUM(totalnf) as valor_total_grupo,
        MIN(data) as data_primeira_fatura,
        MAX(data) as data_ultima_fatura,
        string_agg(codfat, ', ') as faturas_do_grupo
      FROM dbfatura 
      WHERE codgp IS NOT NULL
      GROUP BY codgp
      ORDER BY codgp;
    `);
    
    if (groupResult.rows.length > 0) {
      console.log('CODGP'.padEnd(8) + 'QTD'.padEnd(6) + 'VALOR TOTAL'.padEnd(15) + 'PERÍODO'.padEnd(25) + 'FATURAS');
      console.log('-'.repeat(80));
      
      groupResult.rows.forEach(row => {
        const valorTotal = row.valor_total_grupo ? 
          parseFloat(row.valor_total_grupo).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : 
          '0,00';
        
        const dataInicio = row.data_primeira_fatura ? 
          new Date(row.data_primeira_fatura).toLocaleDateString('pt-BR') : 
          'N/A';
        
        const dataFim = row.data_ultima_fatura ? 
          new Date(row.data_ultima_fatura).toLocaleDateString('pt-BR') : 
          'N/A';
        
        const periodo = dataInicio === dataFim ? dataInicio : `${dataInicio} a ${dataFim}`;
        
        console.log(
          (row.codgp || '').toString().padEnd(8) +
          (row.quantidade_faturas || '').toString().padEnd(6) +
          ('R$ ' + valorTotal).padEnd(15) +
          periodo.padEnd(25) +
          (row.faturas_do_grupo || '').toString()
        );
      });
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao consultar faturas:', error.message);
    process.exit(1);
  }
}

consultarFaturasAgrupadas();

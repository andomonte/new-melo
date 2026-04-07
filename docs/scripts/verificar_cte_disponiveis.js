const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function verificarCTeDisponiveis() {
  console.log('🔍 [Verificação] Buscando CT-e disponíveis para teste...');

  try {
    // Buscar CT-e não pagas (pago = 'N')
    const result = await pool.query(`
      SELECT
        nc.codtransp,
        nc.nrocon,
        nc.totaltransp,
        nc.pago,
        t.nome as nome_transportadora
      FROM dbconhecimentoent nc
      JOIN dbtransp t ON nc.codtransp = t.codtransp
      WHERE nc.pago = 'N'
      ORDER BY nc.nrocon DESC
      LIMIT 5
    `);

    console.log(`📋 [Verificação] Encontradas ${result.rows.length} CT-e não pagas:`);

    result.rows.forEach((cte, index) => {
      console.log(`${index + 1}. CT-e: ${cte.codtransp}-${cte.nrocon}`);
      console.log(`   Transportadora: ${cte.nome_transportadora}`);
      console.log(`   Valor: R$ ${cte.totaltransp}`);
      console.log(`   Pago: ${cte.pago}`);
      console.log('---');
    });

    if (result.rows.length > 0) {
      console.log('💡 [Verificação] Use estes dados no teste da API:');
      console.log(JSON.stringify({
        cod_transp: result.rows[0].codtransp,
        cod_conta: '0001', // Ajustar conforme necessário
        cod_ccusto: '0001', // Ajustar conforme necessário
        cod_comprador: '001', // Ajustar conforme necessário
        dt_venc: '2025-12-15',
        obs: 'Teste de geração automática de título CT-e',
        notas: [{
          codtransp: result.rows[0].codtransp,
          nrocon: result.rows[0].nrocon
        }]
      }, null, 2));
    }

  } catch (error) {
    console.error('❌ [Verificação] Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarCTeDisponiveis();
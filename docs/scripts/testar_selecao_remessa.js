const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
async function testarSelecaoRemessa() {


  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Usar datas recentes para teste
    const dtini = '2024-01-01';
    const dtfim = '2025-12-31';
    const codBc = '237'; // BRADESCO

    console.log(`🔍 Testando seleção de remessa para BRADESCO (${codBc}):`);
    console.log(`   Período: ${dtini} a ${dtfim}\n`);

    // PARTE 1: REMESSA (novos títulos)
    console.log('📋 PARTE 1 - NOVOS TÍTULOS PARA REMESSA:\n');
    const parte1 = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN r.bradesco = 'N' THEN 1 END) as bradesco_n,
        COUNT(CASE WHEN r.bradesco = 'S' THEN 1 END) as bradesco_s,
        COUNT(CASE WHEN r.cancel = 'N' THEN 1 END) as nao_cancelado,
        COUNT(CASE WHEN r.rec = 'N' THEN 1 END) as nao_recebido,
        COUNT(CASE WHEN r.forma_fat = 'B' THEN 1 END) as forma_boleto,
        COUNT(CASE WHEN r.valor_pgto > 0 THEN 1 END) as valor_maior_zero,
        COUNT(CASE WHEN (r.venc_ant IS NULL OR r.dt_venc = r.venc_ant) THEN 1 END) as vencimento_nao_alterado
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
    `, [dtini, dtfim, codBc]);

    console.log('Análise dos filtros:');
    console.log(`  Total de títulos no período: ${parte1.rows[0].total}`);
    console.log(`  - bradesco = 'N' (não enviado): ${parte1.rows[0].bradesco_n}`);
    console.log(`  - bradesco = 'S' (já enviado): ${parte1.rows[0].bradesco_s}`);
    console.log(`  - cancel = 'N' (não cancelado): ${parte1.rows[0].nao_cancelado}`);
    console.log(`  - rec = 'N' (não recebido): ${parte1.rows[0].nao_recebido}`);
    console.log(`  - forma_fat = '2' (boleto): ${parte1.rows[0].forma_boleto}`);
    console.log(`  - valor_pgto > 0: ${parte1.rows[0].valor_maior_zero}`);
    console.log(`  - vencimento não alterado: ${parte1.rows[0].vencimento_nao_alterado}\n`);

    // Query com TODAS as condições
    const parte1Real = await client.query(`
      SELECT COUNT(*) as total
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
        AND COALESCE(r.bradesco, 'N') = 'N'
        AND COALESCE(r.cancel, 'N') = 'N'
        AND COALESCE(r.rec, 'N') = 'N'
        AND COALESCE(r.forma_fat, '') = 'B'
        AND r.valor_pgto > 0
        AND (r.venc_ant IS NULL OR r.dt_venc = r.venc_ant)
    `, [dtini, dtfim, codBc]);

    console.log(`✅ Títulos que DEVEM ir para REMESSA (código 01): ${parte1Real.rows[0].total}\n`);

    // PARTE 2: BAIXA
    console.log('📋 PARTE 2 - TÍTULOS PARA BAIXA:\n');
    const parte2 = await client.query(`
      SELECT COUNT(*) as total
      FROM db_manaus.dbdocbodero_baixa_banco db
      INNER JOIN db_manaus.dbreceb r ON r.cod_receb = db.cod_receb
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
        AND COALESCE(db.export, 0) = 0
    `, [dtini, dtfim, codBc]);

    console.log(`✅ Títulos que DEVEM ir para BAIXA (código 02): ${parte2.rows[0].total}\n`);

    // PARTE 3: PRORROGAÇÃO
    console.log('📋 PARTE 3 - TÍTULOS PRORROGADOS:\n');
    
    // Primeiro, verificar quantos títulos têm vencimento alterado
    const analise3 = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN r.venc_ant IS NOT NULL THEN 1 END) as tem_venc_ant,
        COUNT(CASE WHEN r.venc_ant IS NOT NULL AND r.dt_venc <> r.venc_ant THEN 1 END) as venc_diferente,
        COUNT(CASE WHEN r.bradesco = 'S' THEN 1 END) as bradesco_s,
        COUNT(CASE WHEN r.cancel = 'N' THEN 1 END) as nao_cancelado
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
    `, [dtini, dtfim, codBc]);

    console.log('Análise dos filtros de prorrogação:');
    console.log(`  Total de títulos: ${analise3.rows[0].total}`);
    console.log(`  - Tem venc_ant: ${analise3.rows[0].tem_venc_ant}`);
    console.log(`  - Vencimento diferente: ${analise3.rows[0].venc_diferente}`);
    console.log(`  - bradesco = 'S' (já enviado): ${analise3.rows[0].bradesco_s}`);
    console.log(`  - cancel = 'N': ${analise3.rows[0].nao_cancelado}\n`);

    const parte3 = await client.query(`
      SELECT COUNT(*) as total
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
        AND r.venc_ant IS NOT NULL
        AND r.dt_venc <> r.venc_ant
        AND COALESCE(r.bradesco, 'N') = 'S'
        AND COALESCE(r.cancel, 'N') = 'N'
    `, [dtini, dtfim, codBc]);

    console.log(`✅ Títulos que DEVEM ir para PRORROGAÇÃO (código 06): ${parte3.rows[0].total}\n`);

    // TOTAL
    const totalGerado = parseInt(parte1Real.rows[0].total) + 
                       parseInt(parte2.rows[0].total) + 
                       parseInt(parte3.rows[0].total);

    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 RESUMO - Títulos que DEVEM ser gerados no arquivo CNAB:`);
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  REMESSA (01):     ${parte1Real.rows[0].total.padStart(6)} títulos`);
    console.log(`  BAIXA (02):       ${parte2.rows[0].total.padStart(6)} títulos`);
    console.log(`  PRORROGAÇÃO (06): ${parte3.rows[0].total.padStart(6)} títulos`);
    console.log('───────────────────────────────────────────────────────');
    console.log(`  TOTAL:            ${String(totalGerado).padStart(6)} títulos`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verificar o que a API de consulta retorna
    console.log('🔍 Comparando com a API de CONSULTA (/api/remessa/titulos):\n');
    
    const consultaAPI = await client.query(`
      WITH remessa AS (
        SELECT 'REMESSA' as situacao
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
        WHERE r.dt_venc BETWEEN $1 AND $2
          AND cb.cod_bc = $3
          AND COALESCE(r.bradesco, 'N') = 'N'
          AND COALESCE(r.cancel, 'N') = 'N'
          AND COALESCE(r.rec, 'N') = 'N'
          AND COALESCE(r.forma_fat, '') = 'B'
          AND r.valor_pgto > 0
          AND (r.venc_ant IS NULL OR r.dt_venc = r.venc_ant)
      ),
      baixa AS (
        SELECT 'BAIXAR TITULO' as situacao
        FROM db_manaus.dbdocbodero_baixa_banco db
        INNER JOIN db_manaus.dbreceb r ON r.cod_receb = db.cod_receb
        LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
        WHERE r.dt_venc BETWEEN $1 AND $2
          AND cb.cod_bc = $3
          AND COALESCE(db.export, 0) = 0
      ),
      prorrogacao AS (
        SELECT 'PRORROGAR TITULO' as situacao
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
        WHERE r.dt_venc BETWEEN $1 AND $2
          AND cb.cod_bc = $3
          AND r.venc_ant IS NOT NULL
          AND r.dt_venc <> r.venc_ant
          AND COALESCE(r.bradesco, 'N') = 'S'
          AND COALESCE(r.cancel, 'N') = 'N'
      )
      SELECT 
        situacao,
        COUNT(*) as qtd
      FROM (
        SELECT * FROM remessa
        UNION ALL
        SELECT * FROM baixa
        UNION ALL
        SELECT * FROM prorrogacao
      ) todos
      GROUP BY situacao
    `, [dtini, dtfim, codBc]);

    console.log('Resultado da API de consulta:');
    consultaAPI.rows.forEach(row => {
      console.log(`  ${row.situacao.padEnd(18)}: ${row.qtd.padStart(6)} títulos`);
    });

    const totalConsulta = consultaAPI.rows.reduce((sum, row) => sum + parseInt(row.qtd), 0);
    console.log('───────────────────────────────────────────────────────');
    console.log(`  TOTAL CONSULTA:   ${String(totalConsulta).padStart(6)} títulos\n`);

    if (totalGerado === totalConsulta) {
      console.log('✅ CONSULTA e GERAÇÃO estão ALINHADAS!\n');
    } else {
      console.log('⚠️ DIVERGÊNCIA entre CONSULTA e GERAÇÃO!\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('✅ Conexão fechada');
  }
}

testarSelecaoRemessa();

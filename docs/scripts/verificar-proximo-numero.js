// Verificar próximo número disponível após correções
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarProximoNumero() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando próximo número disponível para série 2...\n');

    const query = `
      SELECT MAX(numero) as ultimo_numero
      FROM (
        -- ✅ PRIORIDADE 1: Números AUTORIZADOS na SEFAZ (status 100)
        SELECT CAST(nfe.nrodoc_fiscal AS INTEGER) as numero
        FROM db_manaus.dbfat_nfe nfe
        INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
        WHERE f.serie = '2'
          AND nfe.nrodoc_fiscal IS NOT NULL
          AND nfe.nrodoc_fiscal != ''
          AND nfe.nrodoc_fiscal::text ~ '^[0-9]+$'
          AND nfe.status = '100'  -- APENAS AUTORIZADAS
      ) AS todos_numeros
    `;

    const result = await pool.query(query);

    if (result.rows.length > 0 && result.rows[0].ultimo_numero !== null) {
      const ultimoNumero = result.rows[0].ultimo_numero;
      const proximoNumero = ultimoNumero + 1;
      
      console.log(`✅ Último número AUTORIZADO: ${ultimoNumero}`);
      console.log(`🎯 Próximo número disponível: ${proximoNumero}`);
      console.log(`📋 Formato para emissão: ${String(proximoNumero).padStart(9, '0')}`);
    } else {
      console.log('❌ Nenhuma NFe autorizada encontrada com série 2!');
      console.log('⚠️  Isso não deveria acontecer...');
    }

    console.log('\n📊 Verificando faturas com série configurada:');
    const queryFaturas = `
      SELECT f.codfat, f.serie, f.nroform, nfe.nrodoc_fiscal, nfe.status
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON nfe.codfat = f.codfat
      WHERE f.codfat IN ('000234546', '000234576', '000234577', '000234578')
      ORDER BY f.codfat
    `;

    const faturasResult = await pool.query(queryFaturas);

    console.log('\nFaturas de teste:');
    faturasResult.rows.forEach(row => {
      console.log(`   ${row.codfat} | série: ${row.serie || 'NULL'} | nfe: ${row.nrodoc_fiscal || 'N/A'} | status: ${row.status || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarProximoNumero();

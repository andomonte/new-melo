require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function corrigirDadosInvalidos() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando correção de dados inválidos...\n');
    
    await client.query('BEGIN');
    
    // Corrigir nroform: pegar apenas o primeiro valor antes da vírgula
    const resultNroform = await client.query(`
      UPDATE db_manaus.dbfatura
      SET nroform = TRIM(SPLIT_PART(nroform, ',', 1))
      WHERE nroform LIKE '%,%'
      RETURNING codfat, nroform
    `);
    
    console.log(`✅ Corrigidos ${resultNroform.rowCount} registros de nroform:`);
    if (resultNroform.rows.length > 0) {
      console.table(resultNroform.rows);
    }
    
    // Corrigir codfat se necessário
    const resultCodfat = await client.query(`
      UPDATE db_manaus.dbfatura
      SET codfat = TRIM(SPLIT_PART(codfat, ',', 1))
      WHERE codfat LIKE '%,%'
      RETURNING codfat, codcli
    `);
    
    if (resultCodfat.rowCount > 0) {
      console.log(`\n✅ Corrigidos ${resultCodfat.rowCount} registros de codfat:`);
      console.table(resultCodfat.rows);
    }
    
    // Corrigir selo se necessário
    const resultSelo = await client.query(`
      UPDATE db_manaus.dbfatura
      SET selo = TRIM(SPLIT_PART(selo, ',', 1))
      WHERE selo LIKE '%,%'
      RETURNING codfat, selo
    `);
    
    if (resultSelo.rowCount > 0) {
      console.log(`\n✅ Corrigidos ${resultSelo.rowCount} registros de selo:`);
      console.table(resultSelo.rows);
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Correção concluída com sucesso!');
    console.log('🔍 Verificando novamente...\n');
    
    // Verificar se ainda há registros inválidos
    const verificacao = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE codfat LIKE '%,%' OR codfat !~ '^[0-9]+$') as codfat_invalidos,
        COUNT(*) FILTER (WHERE nroform LIKE '%,%' OR (nroform IS NOT NULL AND nroform !~ '^[0-9]+$')) as nroform_invalidos,
        COUNT(*) FILTER (WHERE selo LIKE '%,%' OR (selo IS NOT NULL AND selo !~ '^[0-9]+$')) as selo_invalidos
      FROM db_manaus.dbfatura
    `);
    
    const v = verificacao.rows[0];
    if (v.codfat_invalidos == 0 && v.nroform_invalidos == 0 && v.selo_invalidos == 0) {
      console.log('✅ Todos os dados estão válidos agora!');
    } else {
      console.log('⚠️  Ainda existem registros inválidos:');
      console.log(`   Codfat: ${v.codfat_invalidos}`);
      console.log(`   Nroform: ${v.nroform_invalidos}`);
      console.log(`   Selo: ${v.selo_invalidos}`);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao corrigir dados:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

corrigirDadosInvalidos();

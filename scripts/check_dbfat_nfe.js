// Script para verificar se o registro foi criado em dbfat_nfe
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/melo'
  });

  const client = await pool.connect();
  const codfat = '000234925';
  
  try {
    console.log(`\n📊 Verificando registro para codfat ${codfat}...\n`);
    
    // 1. Verificar dbfat_nfe
    const nfeResult = await client.query(
      `SELECT codfat, status, motivo, modelo, chave FROM db_manaus.dbfat_nfe WHERE codfat = $1`,
      [codfat]
    );
    
    if (nfeResult.rows.length > 0) {
      console.log('✅ Registro encontrado em dbfat_nfe:');
      console.table(nfeResult.rows);
    } else {
      console.log('❌ Nenhum registro em dbfat_nfe para este codfat');
    }
    
    // 2. Verificar dbfatura
    const faturaResult = await client.query(
      `SELECT codfat, nfs, info_compl FROM db_manaus.dbfatura WHERE codfat = $1`,
      [codfat]
    );
    
    console.log('\n📋 Registro em dbfatura:');
    console.table(faturaResult.rows);
    
    // 3. Verificar query completa de listar-faturas
    const listarResult = await client.query(`
      SELECT
        f.codfat,
        f.info_compl,
        nfe.status AS nfe_status,
        nfe.motivo AS nfe_motivo,
        CASE 
          WHEN nfe.status IS NOT NULL AND nfe.status != '100' THEN nfe.motivo
          ELSE NULL
        END AS mensagem_rejeicao
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      WHERE f.codfat = $1
    `, [codfat]);
    
    console.log('\n🔍 Query simulando listar-faturas:');
    console.table(listarResult.rows);
    
  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

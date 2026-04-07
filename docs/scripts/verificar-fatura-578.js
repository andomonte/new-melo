// Verificar fatura 000234578 e suas tentativas de emissão
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarFatura578() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Investigando fatura 000234578...\n');

    // 1. Dados da fatura
    const queryFatura = `
      SELECT * FROM db_manaus.dbfatura 
      WHERE codfat = '000234578'
    `;
    const faturaResult = await pool.query(queryFatura);

    if (faturaResult.rows.length === 0) {
      console.log('❌ Fatura 000234578 NÃO ENCONTRADA no banco!');
      console.log('⚠️  Isso significa que ela pode ter sido criada apenas em memória.\n');
    } else {
      console.log('✅ Fatura encontrada:');
      const fatura = faturaResult.rows[0];
      console.log(`   codfat: ${fatura.codfat}`);
      console.log(`   codcli: ${fatura.codcli}`);
      console.log(`   nroform: ${fatura.nroform}`);
      console.log(`   serie: ${fatura.serie}`);
      console.log(`   nfs: ${fatura.nfs}`);
      console.log(`   data: ${fatura.data}`);
      console.log(`   totalfat: ${fatura.totalfat}`);
      console.log('');
    }

    // 2. Tentativas de NFe para essa fatura
    const queryNFe = `
      SELECT * FROM db_manaus.dbfat_nfe 
      WHERE codfat = '000234578'
      ORDER BY dthrprotocolo DESC
    `;
    const nfeResult = await pool.query(queryNFe);

    console.log(`📋 Tentativas de emissão para fatura 000234578: ${nfeResult.rows.length}`);
    console.log('');

    if (nfeResult.rows.length > 0) {
      nfeResult.rows.forEach((nfe, index) => {
        console.log(`--- Tentativa ${index + 1} ---`);
        console.log(`   nrodoc_fiscal: ${nfe.nrodoc_fiscal}`);
        console.log(`   chave: ${nfe.chave}`);
        console.log(`   status: ${nfe.status}`);
        console.log(`   numprotocolo: ${nfe.numprotocolo || 'N/A'}`);
        console.log(`   motivo: ${nfe.motivo || 'N/A'}`);
        console.log(`   dthrprotocolo: ${nfe.dthrprotocolo}`);
        console.log('');
      });
    }

    // 3. Buscar todas as faturas criadas recentemente
    const queryRecentes = `
      SELECT codfat, codcli, nroform, serie, nfs, data 
      FROM db_manaus.dbfatura 
      WHERE codfat >= '000234570'
      ORDER BY codfat DESC
      LIMIT 15
    `;
    const recentesResult = await pool.query(queryRecentes);

    console.log('📊 Últimas 15 faturas criadas (>=000234570):');
    recentesResult.rows.forEach(f => {
      console.log(`   ${f.codfat} | cliente: ${f.codcli} | nroform: ${f.nroform} | serie: ${f.serie || 'NULL'} | nfs: ${f.nfs}`);
    });
    console.log('');

    // 4. Verificar se existe fatura 000234579 (próxima)
    const query579 = `
      SELECT codfat FROM db_manaus.dbfatura 
      WHERE codfat = '000234579'
    `;
    const result579 = await pool.query(query579);

    if (result579.rows.length > 0) {
      console.log('⚠️  ATENÇÃO: Fatura 000234579 JÁ EXISTE!');
      console.log('   Isso significa que o sistema tentou criar uma nova fatura.');
    } else {
      console.log('✅ Fatura 000234579 não existe ainda (próximo número disponível)');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarFatura578();

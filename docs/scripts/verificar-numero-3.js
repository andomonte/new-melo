// Verificar status do número 3 na série 2
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarNumero3() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Buscando TODAS as NFes com número 3 na série 2...\n');

    const query = `
      SELECT 
        nfe.codfat,
        nfe.nrodoc_fiscal,
        nfe.chave,
        nfe.status,
        nfe.numprotocolo,
        nfe.motivo,
        nfe.dthrprotocolo,
        f.serie,
        f.nroform
      FROM db_manaus.dbfat_nfe nfe
      LEFT JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE nfe.nrodoc_fiscal::text = '3'
      ORDER BY nfe.dthrprotocolo DESC
    `;

    const result = await pool.query(query);

    console.log(`📋 Total de registros encontrados: ${result.rows.length}\n`);

    if (result.rows.length > 0) {
      result.rows.forEach((nfe, index) => {
        console.log(`--- Registro ${index + 1} ---`);
        console.log(`   codfat: ${nfe.codfat}`);
        console.log(`   nrodoc_fiscal: ${nfe.nrodoc_fiscal}`);
        console.log(`   chave: ${nfe.chave}`);
        console.log(`   status: ${nfe.status} ${nfe.status === '100' ? '✅ AUTORIZADA' : '❌ REJEITADA'}`);
        console.log(`   protocolo: ${nfe.numprotocolo || 'N/A'}`);
        console.log(`   motivo: ${nfe.motivo || 'N/A'}`);
        console.log(`   fatura.serie: ${nfe.serie || 'NULL'}`);
        console.log(`   fatura.nroform: ${nfe.nroform}`);
        console.log(`   data/hora: ${nfe.dthrprotocolo}`);
        console.log('');
      });
    }

    // Verificar qual a chave que SEFAZ diz que existe
    console.log('🔍 Chave que SEFAZ aponta como duplicada:');
    console.log('   13251018053139000169550020000000031000310510');
    console.log('');

    const queryChave = `
      SELECT 
        nfe.codfat,
        nfe.status,
        f.serie
      FROM db_manaus.dbfat_nfe nfe
      LEFT JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE nfe.chave = '13251018053139000169550020000000031000310510'
    `;

    const chaveResult = await pool.query(queryChave);

    if (chaveResult.rows.length > 0) {
      console.log('✅ Chave encontrada no banco!');
      chaveResult.rows.forEach(row => {
        console.log(`   codfat: ${row.codfat}`);
        console.log(`   status: ${row.status}`);
        console.log(`   serie: ${row.serie || 'NULL'}`);
      });
    } else {
      console.log('❌ Chave NÃO encontrada no banco local!');
      console.log('   Isso significa que a NFe está apenas na SEFAZ.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarNumero3();

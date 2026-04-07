// Verificar detalhes do CODFAT 000234546
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function verificarFatura() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando fatura 000234546...\n');

    const query = `
      SELECT * FROM db_manaus.dbfatura 
      WHERE codfat = '000234546'
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Fatura 000234546 NÃO ENCONTRADA na tabela dbfatura!');
      console.log('');
      console.log('💡 Isso explica por que a query MAX() não encontrou o número 1:');
      console.log('   - NFe existe em dbfat_nfe');
      console.log('   - Mas fatura não existe (ou não tem série) em dbfatura');
      console.log('   - JOIN falha e número 1 é ignorado');
      console.log('');
    } else {
      const fatura = result.rows[0];
      console.log('✅ Fatura encontrada:');
      console.log(`   CODFAT: ${fatura.codfat}`);
      console.log(`   Série: ${fatura.serie || 'NULL ❌'}`);
      console.log(`   nroform: ${fatura.nroform || 'NULL'}`);
      console.log(`   Total: ${fatura.totalnf || 'NULL'}`);
      console.log(`   Data: ${fatura.data || 'NULL'}`);
      console.log('');

      if (!fatura.serie || fatura.serie !== '2') {
        console.log('⚠️ PROBLEMA ENCONTRADO:');
        console.log('   A fatura NÃO tem série="2" configurada!');
        console.log('   Por isso a query JOIN não encontra o número 1');
        console.log('');
        console.log('✅ SOLUÇÃO: Atualizar a fatura com série="2"');
        console.log('');
        console.log('Execute:');
        console.log(`   UPDATE db_manaus.dbfatura SET serie='2' WHERE codfat='000234546';`);
        console.log('');
      }
    }

    // Verificar número 2
    console.log('🔍 Verificando NFe número 2...\n');
    
    const query2 = `
      SELECT nfe.*, f.serie 
      FROM db_manaus.dbfat_nfe nfe
      LEFT JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE nfe.chave = '13251018053139000169550020000000021000240867'
    `;

    const result2 = await pool.query(query2);

    if (result2.rows.length === 0) {
      console.log('❌ NFe número 2 NÃO ENCONTRADA no banco!');
      console.log('   Chave: 13251018053139000169550020000000021000240867');
      console.log('');
      console.log('⚠️ Esta NFe foi autorizada na SEFAZ mas não está no banco local');
      console.log('');
    } else {
      const nfe2 = result2.rows[0];
      console.log('✅ NFe número 2 encontrada:');
      console.log(`   CODFAT: ${nfe2.codfat}`);
      console.log(`   Série fatura: ${nfe2.serie || 'NULL ❌'}`);
      console.log(`   Status: ${nfe2.status}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarFatura();

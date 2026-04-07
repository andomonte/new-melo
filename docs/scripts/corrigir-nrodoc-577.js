// Corrigir nrodoc_fiscal da fatura 000234577
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function corrigirNrodocFiscal577() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔧 Corrigindo nrodoc_fiscal da fatura 000234577...\n');

    // A chave mostra que o número é 3
    const query = `
      UPDATE db_manaus.dbfat_nfe 
      SET nrodoc_fiscal = '3'
      WHERE codfat = '000234577' 
        AND status = '100'
      RETURNING codfat, nrodoc_fiscal, chave
    `;

    const result = await pool.query(query);

    if (result.rowCount > 0) {
      console.log('✅ NFe atualizada com sucesso!');
      result.rows.forEach(row => {
        console.log(`   codfat: ${row.codfat}`);
        console.log(`   nrodoc_fiscal: ${row.nrodoc_fiscal}`);
        console.log(`   chave: ${row.chave}`);
      });
    } else {
      console.log('❌ NFe não encontrada!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

corrigirNrodocFiscal577();

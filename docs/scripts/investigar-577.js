// Investigar fatura 000234577 - por que o número está tão alto?
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function investigar577() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Investigando fatura 000234577...\n');

    const query = `
      SELECT 
        f.codfat,
        f.nroform,
        f.serie,
        nfe.nrodoc_fiscal,
        nfe.chave,
        nfe.status
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON nfe.codfat = f.codfat
      WHERE f.codfat = '000234577'
    `;

    const result = await pool.query(query);

    console.log('Dados encontrados:');
    result.rows.forEach(row => {
      console.log(`   codfat: ${row.codfat}`);
      console.log(`   nroform (fatura): ${row.nroform}`);
      console.log(`   série: ${row.serie}`);
      console.log(`   nrodoc_fiscal (nfe): ${row.nrodoc_fiscal}`);
      console.log(`   chave: ${row.chave}`);
      console.log(`   status: ${row.status}`);
      console.log('');
    });

    console.log('🔍 Análise da chave:');
    const chave = result.rows[0]?.chave;
    if (chave) {
      console.log(`   Chave completa: ${chave}`);
      console.log(`   UF: ${chave.substring(0, 2)}`);
      console.log(`   AAMM: ${chave.substring(2, 6)}`);
      console.log(`   CNPJ: ${chave.substring(6, 20)}`);
      console.log(`   Modelo: ${chave.substring(20, 22)}`);
      console.log(`   Série: ${chave.substring(22, 25)}`);
      console.log(`   Número NFe: ${chave.substring(25, 34)}`);
      console.log(`   cNF: ${chave.substring(34, 42)}`);
      console.log(`   DV: ${chave.substring(42, 43)}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

investigar577();

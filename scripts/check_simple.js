// Script simples para verificar dbfat_nfe
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const codfat = '000234925';
  
  try {
    const res = await pool.query(
      `SELECT codfat, status, motivo FROM db_manaus.dbfat_nfe WHERE codfat = $1`,
      [codfat]
    );
    
    if (res.rows.length > 0) {
      console.log('ENCONTRADO em dbfat_nfe:', JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log('NAO ENCONTRADO em dbfat_nfe para codfat:', codfat);
    }
  } catch (err) {
    console.error('ERRO:', err.message);
  } finally {
    await pool.end();
  }
}

main();

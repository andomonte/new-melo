// Atualizar série da fatura 000234577 (NFe #3 autorizada)
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function corrigirSerie577() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔧 Corrigindo série da fatura 000234577...\n');

    const query = `
      UPDATE db_manaus.dbfatura 
      SET serie = '2' 
      WHERE codfat = '000234577'
      RETURNING codfat, serie
    `;

    const result = await pool.query(query);

    if (result.rowCount > 0) {
      console.log('✅ Fatura atualizada com sucesso!');
      console.log(`   codfat: ${result.rows[0].codfat}`);
      console.log(`   série: ${result.rows[0].serie}`);
    } else {
      console.log('❌ Fatura não encontrada!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

corrigirSerie577();

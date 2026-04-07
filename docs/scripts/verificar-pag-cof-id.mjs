import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarPagCofId() {
  try {
    console.log('Verificando valores de pag_cof_id...\n');
    
    const result = await pool.query(`
      SELECT 
        cod_pgto,
        pag_cof_id,
        tipo,
        cod_credor,
        cod_transp
      FROM dbpgto
      ORDER BY pag_cof_id DESC
      LIMIT 10
    `);

    console.log('Últimos 10 registros:');
    console.log(JSON.stringify(result.rows, null, 2));

    const maxResult = await pool.query(`
      SELECT MAX(pag_cof_id) as max_id FROM dbpgto
    `);

    console.log('\nMáximo pag_cof_id:', maxResult.rows[0].max_id);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarPagCofId();

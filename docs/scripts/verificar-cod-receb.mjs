import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function verificarCodReceb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('🔍 Verificando padrão de cod_receb...\n');
    
    // Buscar últimos códigos
    const result = await pool.query(`
      SELECT cod_receb 
      FROM db_manaus.dbreceb 
      ORDER BY cod_receb DESC 
      LIMIT 20
    `);
    
    console.log('📊 Últimos 20 cod_receb:');
    result.rows.forEach(row => {
      console.log(`   ${row.cod_receb}`);
    });
    
    // Buscar o maior valor numérico
    const maxResult = await pool.query(`
      SELECT MAX(CAST(cod_receb AS INTEGER)) as max_cod
      FROM db_manaus.dbreceb
      WHERE cod_receb ~ '^[0-9]+$'
    `);
    
    console.log('\n📌 Maior cod_receb numérico:', maxResult.rows[0]?.max_cod);
    console.log('📌 Próximo cod_receb sugerido:', (parseInt(maxResult.rows[0]?.max_cod || '0') + 1));
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarCodReceb();

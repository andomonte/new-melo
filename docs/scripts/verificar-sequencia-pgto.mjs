import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function verificarSequencia() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('🔍 Verificando sequências e chaves primárias...\n');
    
    // Verificar se existe sequência para cod_pgto
    const seqResult = await pool.query(`
      SELECT 
        c.column_name,
        c.column_default
      FROM information_schema.columns c
      WHERE c.table_name = 'dbpgto' 
        AND c.column_name = 'cod_pgto'
    `);
    
    console.log('📌 Campo cod_pgto:');
    console.log(seqResult.rows);
    
    // Verificar último cod_pgto usado
    const maxResult = await pool.query(`
      SELECT MAX(cod_pgto::integer) as max_cod FROM dbpgto
    `);
    
    console.log('\n📊 Último código usado:', maxResult.rows[0]?.max_cod);
    
    // Verificar sequences disponíveis
    const sequences = await pool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences
      WHERE sequence_name LIKE '%pgto%' OR sequence_name LIKE '%pag%'
    `);
    
    console.log('\n🔢 Sequências relacionadas:');
    sequences.rows.forEach(row => {
      console.log(`  - ${row.sequence_name}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarSequencia();

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const getPgPool = () => {
  return new Pool({
   connectionString: process.env.DATABASE_URL
  });
};

async function checkTables() {
  const pool = getPgPool();
  
  try {
    console.log('=== Verificando tabela dbbanco ===');
    const bancoCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' AND table_name = 'dbbanco' 
      ORDER BY ordinal_position
    `);
    console.log('Colunas dbbanco:', bancoCols.rows);
    
    const bancoSample = await pool.query(`SELECT * FROM db_manaus.dbbanco LIMIT 3`);
    console.log('\nSample dbbanco:', bancoSample.rows);
    
    console.log('\n=== Verificando tabela dbccusto ===');
    const ccustoCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' AND table_name = 'dbccusto' 
      ORDER BY ordinal_position
    `);
    console.log('Colunas dbccusto:', ccustoCols.rows);
    
    const ccustoSample = await pool.query(`SELECT * FROM db_manaus.dbccusto LIMIT 3`);
    console.log('\nSample dbccusto:', ccustoSample.rows);
    
    console.log('\n=== Verificando relacionamentos em dbpgto ===');
    const pgtoSample = await pool.query(`
      SELECT p.cod_pgto, p.banco, p.cod_ccusto, p.codcomprador
      FROM db_manaus.dbpgto p 
      WHERE p.banco IS NOT NULL OR p.cod_ccusto IS NOT NULL OR p.codcomprador IS NOT NULL
      LIMIT 5
    `);
    console.log('Sample dbpgto:', pgtoSample.rows);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkTables();

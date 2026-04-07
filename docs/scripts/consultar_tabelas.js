const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const getPgPool = () => {
  return new Pool({
  connectionString: process.env.DATABASE_URL
  });
};

async function consultarTabelas() {
  const pool = getPgPool(

    
  );

  try {
    console.log('=== Estrutura da tabela dbconhecimento ===');
    const conhecimentoResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'dbconhecimento' AND table_schema = 'db_manaus'
      ORDER BY ordinal_position
    `);
    console.table(conhecimentoResult.rows);

    console.log('\n=== Estrutura da tabela dbconhecimentoent ===');
    const conhecimentoEntResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'dbconhecimentoent' AND table_schema = 'db_manaus'
      ORDER BY ordinal_position
    `);
    console.table(conhecimentoEntResult.rows);

    console.log('\n=== Amostra de dados dbconhecimento ===');
    const sampleConhecimento = await pool.query('SELECT * FROM db_manaus.dbconhecimento LIMIT 5');
    console.table(sampleConhecimento.rows);

    console.log('\n=== Amostra de dados dbconhecimentoent ===');
    const sampleConhecimentoEnt = await pool.query('SELECT * FROM db_manaus.dbconhecimentoent LIMIT 5');
    console.table(sampleConhecimentoEnt.rows);

    // Verificar relacionamento entre as tabelas
    console.log('\n=== Relacionamento entre tabelas ===');
    const relacaoResult = await pool.query(`
      SELECT
        tc.table_name as tabela,
        kcu.column_name as coluna,
        ccu.table_name AS tabela_referenciada,
        ccu.column_name AS coluna_referenciada
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'db_manaus'
        AND (tc.table_name IN ('dbconhecimento', 'dbconhecimentoent') OR ccu.table_name IN ('dbconhecimento', 'dbconhecimentoent'))
    `);
    console.table(relacaoResult.rows);

  } catch (error) {
    console.error('Erro ao consultar tabelas:', error);
  } finally {
    await pool.end();
  }
}

consultarTabelas();
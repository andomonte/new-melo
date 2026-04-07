const { getPgPool } = require('./src/lib/pg');

async function checkDbccustoColumns() {
  const pool = getPgPool();

  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'dbccusto'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colunas da tabela dbccusto:');
    result.rows.forEach(row => console.log('  -', row.column_name));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    pool.end();
  }
}

checkDbccustoColumns();
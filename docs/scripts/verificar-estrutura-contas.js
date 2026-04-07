const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_DEFAULT || process.env.DATABASE_URL_MANAUS,
});

(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dbdados_banco'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Estrutura da tabela dbdados_banco:');
    console.log('=====================================\n');
    result.rows.forEach((row) => {
      const limit = row.character_maximum_length
        ? `(${row.character_maximum_length})`
        : '';
      const nullable = row.is_nullable === 'YES' ? '✓ NULL' : '✗ NOT NULL';
      console.log(
        `${row.column_name.padEnd(15)} | ${row.data_type.padEnd(
          20,
        )}${limit.padEnd(10)} | ${nullable}`,
      );
    });
    console.log('\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
})();

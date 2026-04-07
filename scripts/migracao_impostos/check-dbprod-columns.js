const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Melodb@2025',
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres'
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbprod'
      ORDER BY ordinal_position
      LIMIT 20
    `);
    console.log('Colunas da tabela dbprod:');
    res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    const resCliente = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbcliente'
      ORDER BY ordinal_position
      LIMIT 20
    `);
    console.log('\nColunas da tabela dbcliente:');
    resCliente.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    await pool.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
})();

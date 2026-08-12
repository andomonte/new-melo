const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres', ssl: false, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();

  // Busca exata
  console.log('=== BUSCA EXATA ref = mb 842 ===');
  const r1 = await client.query(`SELECT codprod, ref, descr FROM db_manaus.dbprod WHERE TRIM(ref) = 'MB 842' LIMIT 5`);
  r1.rows.forEach(r => console.log(r));

  // Busca ILIKE prefixo
  console.log('\n=== BUSCA ILIKE mb 842% ===');
  const r2 = await client.query(`SELECT codprod, ref, descr FROM db_manaus.dbprod WHERE ref ILIKE 'mb 842%' LIMIT 10`);
  r2.rows.forEach(r => console.log(r));

  // Busca ILIKE contém
  console.log('\n=== BUSCA ILIKE %mb 842% ===');
  const r3 = await client.query(`SELECT codprod, ref, descr FROM db_manaus.dbprod WHERE ref ILIKE '%mb 842%' LIMIT 10`);
  r3.rows.forEach(r => console.log(r));

  // Busca sem espaço
  console.log('\n=== BUSCA ILIKE mb842% ===');
  const r4 = await client.query(`SELECT codprod, ref, descr FROM db_manaus.dbprod WHERE ref ILIKE 'mb842%' LIMIT 10`);
  r4.rows.forEach(r => console.log(r));

  // Busca parcial mb%842
  console.log('\n=== BUSCA ILIKE mb%842% ===');
  const r5 = await client.query(`SELECT codprod, ref, descr FROM db_manaus.dbprod WHERE ref ILIKE 'mb%' AND ref ILIKE '%842%' LIMIT 10`);
  r5.rows.forEach(r => console.log(r));

  client.release(); await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

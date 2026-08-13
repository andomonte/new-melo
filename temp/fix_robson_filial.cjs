const { Pool } = require('pg');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Ver como filial é definida - procurar tabelas de filial/armazém do usuário
  console.log('=== TABELAS RELACIONADAS A FILIAL ===');
  const tables = await pgClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'db_manaus' AND (table_name LIKE '%filial%' OR table_name LIKE '%armazem%' OR table_name LIKE '%login%')
    ORDER BY table_name
  `);
  tables.rows.forEach(r => console.log(r.table_name));

  // Ver como um usuário existente (ex: KARLA) tem filial configurada
  console.log('\n=== DADOS KARLA (referência) ===');
  const karla = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'KARLA'`);
  console.log(karla.rows[0]);

  // Procurar tabela de perfil com filial
  console.log('\n=== tb_login_perfil ===');
  try {
    const lp = await pgClient.query(`SELECT * FROM db_manaus.tb_login_perfil LIMIT 5`);
    console.log('Colunas:', Object.keys(lp.rows[0] || {}));
    lp.rows.forEach(r => console.log(r));
  } catch(e) { console.log('Erro:', e.message); }

  // Procurar tabela de armazém do usuário
  console.log('\n=== tb_login_armazem ou similar ===');
  try {
    const la = await pgClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'db_manaus' AND table_name LIKE 'tb_login%' ORDER BY table_name
    `);
    la.rows.forEach(r => console.log(r.table_name));
  } catch(e) {}

  // Ver todas as tabelas tb_login_*
  for (const tbl of ['tb_login_perfil', 'tb_login_filial', 'tb_login_armazem', 'tb_login_access_armazem']) {
    try {
      const r = await pgClient.query(`SELECT * FROM db_manaus.${tbl} LIMIT 3`);
      console.log(`\n=== ${tbl} ===`);
      console.log('Colunas:', Object.keys(r.rows[0] || {}));
      r.rows.forEach(row => console.log(row));
    } catch(e) { /* tabela não existe */ }
  }

  // Procurar onde KARLA tem filial/armazém
  console.log('\n=== BUSCA KARLA EM TODAS tb_login_* ===');
  const allTables = await pgClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'db_manaus' AND table_name LIKE 'tb_login%' ORDER BY table_name
  `);
  for (const t of allTables.rows) {
    try {
      const r = await pgClient.query(`SELECT * FROM db_manaus.${t.table_name} WHERE login_user_login = 'KARLA' LIMIT 3`);
      if (r.rows.length > 0) {
        console.log(`  ${t.table_name}:`, r.rows);
      }
    } catch(e) { /* coluna não existe */ }
  }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

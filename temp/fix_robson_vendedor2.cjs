const { Pool } = require('pg');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Comparar LEANDRO (funciona, adm) com ROBSON.S
  console.log('=== LEANDRO (referência ADM) ===');
  const leandro = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'LEANDRO'`);
  console.log(leandro.rows[0]);

  console.log('\n=== ROBSON (referência VENDAS, funciona) ===');
  const robson = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON'`);
  console.log(robson.rows[0]);

  console.log('\n=== ROBSON.S (novo) ===');
  const robsonS = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON.S'`);
  console.log(robsonS.rows[0]);

  // Ver vendedores no PG
  console.log('\n=== COLUNAS DBVENDEDOR PG ===');
  const cols = await pgClient.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'db_manaus' AND table_name = 'dbvendedor' ORDER BY ordinal_position
  `);
  cols.rows.forEach(r => console.log(r.column_name));

  console.log('\n=== VENDEDORES ROBSON NO PG ===');
  const pgVend = await pgClient.query(`SELECT * FROM db_manaus.dbvendedor WHERE UPPER(cod_vend) LIKE '%ROBSON%' OR UPPER(nome_vend) LIKE '%ROBSON%' LIMIT 5`);
  if (pgVend.rows.length > 0) {
    console.log(pgVend.rows);
  } else {
    // Tentar outras colunas
    const sample = await pgClient.query(`SELECT * FROM db_manaus.dbvendedor LIMIT 3`);
    console.log('Colunas:', Object.keys(sample.rows[0] || {}));
    sample.rows.forEach(r => console.log(r));
  }

  // Filiais de cada um
  for (const login of ['LEANDRO', 'ROBSON', 'ROBSON.S']) {
    const f = await pgClient.query(`SELECT * FROM db_manaus.tb_login_filiais WHERE login_user_login = $1`, [login]);
    const a = await pgClient.query(`SELECT * FROM db_manaus.tb_login_armazem_user WHERE login_user_login = $1`, [login]);
    const fn = await pgClient.query(`
      SELECT f.sigla FROM db_manaus.tb_login_access_user au
      JOIN db_manaus.tb_login_functions f ON f.id_functions = au.id_functions
      WHERE au.login_user_login = $1 ORDER BY f.sigla
    `, [login]);
    console.log(`\n${login}:`);
    console.log(`  Filiais: ${JSON.stringify(f.rows)}`);
    console.log(`  Armazéns: ${a.rows.map(r => `${r.id_armazem}(${r.login_perfil_name})`).join(', ')}`);
    console.log(`  Funções diretas: ${fn.rows.map(r => r.sigla).join(', ')}`);
  }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

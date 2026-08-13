const { Pool } = require('pg');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Ver o ROBSON que funciona
  console.log('=== ROBSON (funciona) ===');
  const robson = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON'`);
  console.log(robson.rows[0]);

  // Ver ROBSON.S
  console.log('\n=== ROBSON.S (não funciona) ===');
  const robsonS = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON.S'`);
  console.log(robsonS.rows[0]);

  // Comparar diferenças
  const r1 = robson.rows[0];
  const r2 = robsonS.rows[0];
  console.log('\n=== DIFERENÇAS ===');
  for (const key of Object.keys(r1)) {
    if (String(r1[key]) !== String(r2[key]) && key !== 'login_user_login' && key !== 'login_user_password' && key !== 'login_user_name') {
      console.log(`  ${key}: ROBSON=${r1[key]} | ROBSON.S=${r2[key]}`);
    }
  }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

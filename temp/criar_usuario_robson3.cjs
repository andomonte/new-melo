const oracledb = require('oracledb');
const { Pool } = require('pg');

async function main() {
  try {
    oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient\\instantclient_23_4' });
  } catch (e) {
    if (!e.message.includes('already')) throw e;
  }

  const oraConn = await oracledb.getConnection({
    user: 'GERAL',
    password: '123',
    connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
  });

  // 1. Ver colunas da DBUSUARIO
  console.log('=== COLUNAS DBUSUARIO ===');
  const cols = await oraConn.execute(
    `SELECT column_name FROM all_tab_columns WHERE table_name = 'DBUSUARIO' ORDER BY column_id`
  );
  cols.rows.forEach(r => console.log(r[0]));

  // 2. Buscar ROBSON
  console.log('\n=== BUSCAR ROBSON ===');
  const r = await oraConn.execute(
    `SELECT CODUSR, NOMEUSR, STUSR, COD_VEND, SENHA FROM DBUSUARIO WHERE UPPER(NOMEUSR) LIKE '%ROBSON%'`
  );
  r.rows.forEach(row => console.log(row));

  if (r.rows.length > 0) {
    const [codusr, nomeusr, stusr, codVend, senha] = r.rows[0];
    console.log(`\n→ ${nomeusr} | codusr: ${codusr} | stusr: ${stusr} | cod_vend: ${codVend} | senha: ${senha}`);

    // 3. Permissões
    console.log('\n=== PERMISSÕES ===');
    const perms = await oraConn.execute(`SELECT * FROM DBPERMISSOES WHERE STUSR = :s`, { s: stusr });
    if (perms.rows.length > 0) {
      const pcols = perms.metaData.map(m => m.name);
      const prow = perms.rows[0];
      pcols.forEach((col, idx) => {
        const val = prow[idx];
        if (val && val !== 'N' && val !== null) console.log(`  ${col} = ${val}`);
      });
    }
  }

  await oraConn.close();

  // --- PG ---
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Estrutura e exemplo
  const ex = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user LIMIT 1`);
  console.log('\n=== EXEMPLO USUARIO PG ===');
  console.log(JSON.stringify(ex.rows[0], null, 2));

  // Verificar se existe
  const exists = await pgClient.query(`SELECT login FROM db_manaus.tb_login_user WHERE UPPER(login) LIKE '%ROBSON%'`);
  console.log('\nROBSON no PG:', exists.rows);

  // Perfis
  const perfis = await pgClient.query(`SELECT DISTINCT login_perfil_name FROM db_manaus.tb_login_access_perfil ORDER BY 1`);
  console.log('\nPerfis:', perfis.rows.map(r => r.login_perfil_name));

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

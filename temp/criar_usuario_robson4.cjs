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

  // Buscar ROBSON
  console.log('=== ROBSON NO ORACLE ===');
  const r = await oraConn.execute(
    `SELECT CODUSR, NOMEUSR, SNUSR, STUSR, COD_VEND, VEN_NV, VEN_BPR, VEN_DEM, VEN_VDO, VEN_DESB, VEN_BPRBALCAO, BLOQUEADO FROM DBUSUARIO WHERE UPPER(NOMEUSR) LIKE '%ROBSON%'`
  );
  r.rows.forEach(row => {
    console.log({
      codusr: row[0], nomeusr: row[1], senha: row[2], stusr: row[3],
      cod_vend: row[4], ven_nv: row[5], ven_bpr: row[6], ven_dem: row[7],
      ven_vdo: row[8], ven_desb: row[9], ven_bprbalcao: row[10], bloqueado: row[11]
    });
  });

  if (r.rows.length === 0) { console.log('Nenhum ROBSON'); await oraConn.close(); return; }

  const [codusr, nomeusr, snusr, stusr, codVend] = r.rows[0];

  // Permissões completas (só as com S)
  console.log('\n=== TODAS PERMISSÕES COM S ===');
  const allPerms = await oraConn.execute(`SELECT * FROM DBUSUARIO WHERE CODUSR = :c`, { c: codusr });
  const pcols = allPerms.metaData.map(m => m.name);
  const prow = allPerms.rows[0];
  const permsS = {};
  pcols.forEach((col, idx) => { if (prow[idx] === 'S') permsS[col] = 'S'; });
  console.log(permsS);

  await oraConn.close();

  // --- PG: criar ---
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Exemplo existente
  const ex = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user LIMIT 1`);
  console.log('\n=== EXEMPLO USUARIO PG ===');
  console.log(JSON.stringify(ex.rows[0], null, 2));

  // Estrutura completa
  const cols2 = await pgClient.query(`
    SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'db_manaus' AND table_name = 'tb_login_user' ORDER BY ordinal_position
  `);
  console.log('\n=== COLUNAS tb_login_user ===');
  cols2.rows.forEach(r => console.log(`${r.column_name} | ${r.data_type} | nullable: ${r.is_nullable} | default: ${r.column_default || '-'}`));

  // Verificar se já existe
  const exists = await pgClient.query(`SELECT login FROM db_manaus.tb_login_user WHERE UPPER(login) LIKE '%ROBSON%'`);
  console.log('\nROBSON no PG:', exists.rows.length > 0 ? exists.rows : 'NÃO EXISTE');

  // Perfis e funções do VENDAS
  console.log('\n=== FUNÇÕES DO PERFIL VENDAS ===');
  const fv = await pgClient.query(`
    SELECT f.sigla, f.descricao FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE ap.login_perfil_name = 'VENDAS' ORDER BY f.sigla
  `);
  fv.rows.forEach(r => console.log(`  ${r.sigla} - ${r.descricao}`));

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

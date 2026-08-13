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

  // 1. Buscar ROBSON no Oracle
  console.log('=== BUSCAR ROBSON NO ORACLE ===');
  const similar = await oraConn.execute(
    `SELECT CODUSR, NOMEUSR, STUSR, COD_VEND, NOME_COMPLETO FROM DBUSUARIO WHERE UPPER(NOMEUSR) LIKE '%ROBSON%' ORDER BY NOMEUSR`
  );
  similar.rows.forEach(r => console.log(r));

  if (similar.rows.length === 0) {
    console.log('Nenhum ROBSON encontrado');
    await oraConn.close();
    return;
  }

  // Pegar o primeiro resultado
  const [codusr, nomeusr, stusr, codVend, nomeCompleto] = similar.rows[0];
  console.log(`\nUsando: ${nomeusr} (codusr: ${codusr}, stusr: ${stusr}, cod_vend: ${codVend})`);

  // 2. Buscar permissões
  console.log('\n=== PERMISSÕES (DBPERMISSOES) ===');
  const perms = await oraConn.execute(
    `SELECT * FROM DBPERMISSOES WHERE STUSR = :stusr`, { stusr }
  );
  if (perms.rows.length > 0) {
    const cols = perms.metaData.map(m => m.name);
    const row = perms.rows[0];
    const relevantes = {};
    cols.forEach((col, idx) => {
      const val = row[idx];
      if (col.startsWith('VEN_') || col.startsWith('FAT_') || col.startsWith('CAD_') || col === 'NOME_PERFIL' || col === 'COD_PERFIL' || col === 'COD_SETOR') {
        relevantes[col] = val;
      }
    });
    console.log(relevantes);
  }

  // 3. Senha
  const senhaResult = await oraConn.execute(
    `SELECT SENHA FROM DBUSUARIO WHERE CODUSR = :c`, { c: codusr }
  );
  const senhaOracle = senhaResult.rows[0]?.[0];
  console.log('\nSenha Oracle:', senhaOracle);

  await oraConn.close();

  // --- PostgreSQL ---
  console.log('\n=== POSTGRESQL ===');
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Ver estrutura
  const loginCols = await pgClient.query(`
    SELECT column_name, data_type, column_default FROM information_schema.columns
    WHERE table_schema = 'db_manaus' AND table_name = 'tb_login_user'
    ORDER BY ordinal_position
  `);
  console.log('Colunas tb_login_user:');
  loginCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) default: ${r.column_default || '-'}`));

  // Exemplo
  const exemplo = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user LIMIT 1`);
  console.log('\nExemplo:', JSON.stringify(exemplo.rows[0], null, 2));

  // Verificar se já existe
  const exists = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE UPPER(login) = $1`, [String(nomeusr).toUpperCase()]);
  console.log('\nJá existe?', exists.rows.length > 0 ? 'SIM' : 'NÃO');
  if (exists.rows.length > 0) console.log(exists.rows[0]);

  // Ver perfis
  const perfis = await pgClient.query(`SELECT DISTINCT login_perfil_name FROM db_manaus.tb_login_access_perfil ORDER BY 1`);
  console.log('\nPerfis:', perfis.rows.map(r => r.login_perfil_name));

  // Ver tb_login_perfil
  const perfilTable = await pgClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'db_manaus' AND table_name LIKE 'tb_login%'
    ORDER BY table_name
  `);
  console.log('\nTabelas login:', perfilTable.rows.map(r => r.table_name));

  // Ver tb_login_perfil conteúdo
  try {
    const lp = await pgClient.query(`SELECT * FROM db_manaus.tb_login_perfil LIMIT 5`);
    console.log('\ntb_login_perfil:', lp.rows);
  } catch(e) { console.log('tb_login_perfil:', e.message); }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

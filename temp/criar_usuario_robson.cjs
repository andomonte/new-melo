const oracledb = require('oracledb');
const { Pool } = require('pg');

async function main() {
  // --- Oracle: buscar dados do ROBSON.S ---
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

  // 1. Buscar usuário no Oracle
  console.log('=== DADOS DO ROBSON.S NO ORACLE ===');
  const user = await oraConn.execute(
    `SELECT u.CODUSR, u.NOMEUSR, u.SENHA, u.COD_VEND, u.STUSR, u.NOME_COMPLETO, u.EMAIL
     FROM DBUSUARIO u WHERE UPPER(u.NOMEUSR) = 'ROBSON.S'`
  );
  if (user.rows.length === 0) {
    // Tentar variações
    const similar = await oraConn.execute(
      `SELECT CODUSR, NOMEUSR, STUSR, COD_VEND, NOME_COMPLETO FROM DBUSUARIO WHERE UPPER(NOMEUSR) LIKE '%ROBSON%' ORDER BY NOMEUSR`
    );
    console.log('Não encontrou ROBSON.S exato. Similares:');
    similar.rows.forEach(r => console.log(r));
    await oraConn.close();
    return;
  }
  const userData = user.rows[0];
  console.log('Usuário:', userData);

  // 2. Buscar permissões do Oracle (DBPERMISSOES via STUSR)
  console.log('\n=== PERMISSÕES NO ORACLE ===');
  const stusr = userData[4]; // STUSR
  const perms = await oraConn.execute(
    `SELECT p.* FROM DBPERMISSOES p WHERE p.STUSR = :stusr`,
    { stusr }
  );
  if (perms.rows.length > 0) {
    const cols = perms.metaData.map(m => m.name);
    const row = perms.rows[0];
    // Mostrar só os campos VEN_* e relevantes
    const relevantes = {};
    cols.forEach((col, idx) => {
      const val = row[idx];
      if (val === 'S' || val === 'N') relevantes[col] = val;
    });
    console.log('Permissões (S/N):', relevantes);

    // Extrair perfil
    const perfilIdx = cols.indexOf('NOME_PERFIL');
    const codPerfilIdx = cols.indexOf('COD_PERFIL');
    if (perfilIdx >= 0) console.log('Perfil Oracle:', row[perfilIdx], '(cod:', row[codPerfilIdx], ')');
  }

  // 3. Buscar dados do vendedor
  const codVend = userData[3];
  if (codVend) {
    const vend = await oraConn.execute(
      `SELECT COD_VEND, NOME FROM DBVENDEDOR WHERE COD_VEND = :cv`, { cv: codVend }
    );
    if (vend.rows.length > 0) console.log('Vendedor:', vend.rows[0]);
  }

  await oraConn.close();

  // --- PostgreSQL: criar o usuário ---
  console.log('\n=== CRIANDO NO POSTGRESQL ===');
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // 4. Ver estrutura das tabelas de login no PG
  const loginTables = await pgClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'db_manaus' AND table_name LIKE 'tb_login%'
    ORDER BY table_name
  `);
  console.log('Tabelas de login:', loginTables.rows.map(r => r.table_name));

  // 5. Ver estrutura tb_login_user
  const loginCols = await pgClient.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'db_manaus' AND table_name = 'tb_login_user'
    ORDER BY ordinal_position
  `);
  console.log('\nColunas tb_login_user:', loginCols.rows);

  // 6. Ver um exemplo de usuário existente
  const exemplo = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user LIMIT 2`);
  console.log('\nExemplo usuários:', exemplo.rows);

  // 7. Ver perfis disponíveis
  const perfis = await pgClient.query(`SELECT DISTINCT login_perfil_name FROM db_manaus.tb_login_access_perfil ORDER BY 1`);
  console.log('\nPerfis disponíveis:', perfis.rows.map(r => r.login_perfil_name));

  // 8. Verificar se ROBSON.S já existe
  const exists = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login = 'ROBSON.S'`);
  if (exists.rows.length > 0) {
    console.log('\n⚠️ ROBSON.S já existe no PG:', exists.rows[0]);
  } else {
    console.log('\nROBSON.S não existe no PG — pronto para criar');
  }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

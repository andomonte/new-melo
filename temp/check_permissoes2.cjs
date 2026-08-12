const oracledb = require('oracledb');

async function main() {
  try {
    oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient\\instantclient_23_4' });
  } catch (e) {
    if (!e.message.includes('already')) throw e;
  }

  const conn = await oracledb.getConnection({
    user: 'GERAL',
    password: '123',
    connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
  });

  // 1. Ver DBPERMISSOES
  console.log('=== ESTRUTURA DBPERMISSOES ===');
  const cols = await conn.execute(
    `SELECT column_name, data_type, data_length
     FROM all_tab_columns WHERE table_name = 'DBPERMISSOES' ORDER BY column_id`
  );
  cols.rows.forEach(r => console.log(r));

  // 2. Amostra DBPERMISSOES
  console.log('\n=== AMOSTRA DBPERMISSOES ===');
  const sample = await conn.execute(`SELECT * FROM DBPERMISSOES WHERE ROWNUM <= 10`);
  console.log('Colunas:', sample.metaData.map(m => m.name));
  sample.rows.forEach(r => console.log(r));

  // 3. Todas as permissões distintas (siglas)
  console.log('\n=== SIGLAS DISTINTAS ===');
  // Verificar se tem campo sigla
  const hasSigla = cols.rows.some(r => r[0] === 'SIGLA');
  if (hasSigla) {
    const siglas = await conn.execute(`SELECT DISTINCT SIGLA FROM DBPERMISSOES ORDER BY SIGLA`);
    siglas.rows.forEach(r => console.log(r));
  }

  // 4. Ver se tem no PG
  console.log('\n=== DBPERMISSOES NO PG ===');
  const { Pool } = require('pg');
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  const pgPerm = await pgClient.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name LIKE '%permiss%' OR table_name LIKE '%funcao%' OR table_name LIKE '%funcoes%'
  `);
  console.log(pgPerm.rows);

  // 5. Ver como o Next.js carrega as funcões do usuário
  // Procurar no login/auth
  pgClient.release();
  await pgPool.end();
  await conn.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });

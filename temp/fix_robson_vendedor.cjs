const oracledb = require('oracledb');
const { Pool } = require('pg');

async function main() {
  // Oracle: buscar dados do vendedor ROBSON
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

  console.log('=== VENDEDORES ROBSON NO ORACLE ===');
  const vend = await oraConn.execute(
    `SELECT COD_VEND, NOME, STUSR FROM DBVENDEDOR WHERE UPPER(NOME) LIKE '%ROBSON%' ORDER BY NOME`
  );
  vend.rows.forEach(r => console.log(r));

  await oraConn.close();

  // PG: ver como o ROBSON (que funciona) está associado a vendedor
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Ver tabela de vendedores no PG
  console.log('\n=== VENDEDORES ROBSON NO PG ===');
  const pgVend = await pgClient.query(`SELECT cod_vend, nome FROM db_manaus.dbvendedor WHERE UPPER(nome) LIKE '%ROBSON%' ORDER BY nome`);
  pgVend.rows.forEach(r => console.log(r));

  // Ver como a associação usuário-vendedor é feita
  console.log('\n=== TABELAS DE ASSOCIAÇÃO USUARIO-VENDEDOR ===');
  const tables = await pgClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'db_manaus' AND (table_name LIKE '%vendedor%' OR table_name LIKE '%vend%login%' OR table_name LIKE '%login%vend%')
    ORDER BY table_name
  `);
  tables.rows.forEach(r => console.log(r.table_name));

  // Ver como o ROBSON que funciona tem vendedor associado
  console.log('\n=== ROBSON - como funciona o vendedor ===');
  // Procurar em tb_login_user se tem campo de vendedor
  const robsonArms = await pgClient.query(`SELECT * FROM db_manaus.tb_login_armazem_user WHERE login_user_login = 'ROBSON'`);
  console.log('Armazéns ROBSON:', robsonArms.rows);

  // Procurar qualquer associação
  const allTables = await pgClient.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'db_manaus' ORDER BY table_name
  `);
  for (const t of allTables.rows) {
    try {
      const cols = await pgClient.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'db_manaus' AND table_name = $1
        AND (column_name LIKE '%vend%' OR column_name LIKE '%cod_vend%')
      `, [t.table_name]);
      if (cols.rows.length > 0 && t.table_name.includes('login')) {
        console.log(`  ${t.table_name}: ${cols.rows.map(c => c.column_name).join(', ')}`);
      }
    } catch(e) {}
  }

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

const oracledb = require('oracledb');

async function main() {
  try {
    oracledb.initOracleClient({ libDir: 'C:\oracle\instantclient\instantclient_23_4' });
  } catch (e) {
    if (!e.message.includes('already')) throw e;
  }

  const conn = await oracledb.getConnection({
    user: 'GERAL',
    password: '123',
    connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
  });

  const result = await conn.execute(
    "SELECT text FROM all_source WHERE name = 'REGRAS_VENDAS' AND type = 'PACKAGE BODY' ORDER BY line"
  );
  result.rows.forEach(row => process.stdout.write(row[0]));

  await conn.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });

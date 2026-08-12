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

  // 1. Package REGRAS_VENDAS body
  console.log('=== PACKAGE REGRAS_VENDAS (BODY) ===');
  const pkg = await conn.execute(
    `SELECT text FROM all_source WHERE name = 'REGRAS_VENDAS' AND type = 'PACKAGE BODY' ORDER BY line`
  );
  if (pkg.rows.length > 0) {
    pkg.rows.forEach(r => process.stdout.write(r[0]));
  } else {
    console.log('(vazio)');
  }

  // 2. Package REGRAS_VENDAS spec
  console.log('\n\n=== PACKAGE REGRAS_VENDAS (SPEC) ===');
  const spec = await conn.execute(
    `SELECT text FROM all_source WHERE name = 'REGRAS_VENDAS' AND type = 'PACKAGE' ORDER BY line`
  );
  if (spec.rows.length > 0) {
    spec.rows.forEach(r => process.stdout.write(r[0]));
  } else {
    console.log('(vazio)');
  }

  // 3. Se não achou como package, tentar como procedure avulsa
  if (pkg.rows.length === 0) {
    console.log('\n\n=== PROCEDURE AVULSA SUBMETER_REGRA ===');
    const proc = await conn.execute(
      `SELECT text FROM all_source WHERE name = 'SUBMETER_REGRA' ORDER BY line`
    );
    if (proc.rows.length > 0) {
      proc.rows.forEach(r => process.stdout.write(r[0]));
    } else {
      console.log('(vazio)');
    }

    // 4. Buscar qualquer objeto com SUBMETER_REGRA no nome
    console.log('\n\n=== OBJETOS COM SUBMETER_REGRA ===');
    const objs = await conn.execute(
      `SELECT DISTINCT name, type FROM all_source WHERE UPPER(text) LIKE '%SUBMETER_REGRA%' ORDER BY name, type`
    );
    objs.rows.forEach(r => console.log(r));
  }

  await conn.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });

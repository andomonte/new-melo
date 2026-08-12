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

  // 1. Campos ven_* na tabela DBUSUARIO
  console.log('=== CAMPOS VEN_* NA DBUSUARIO ===');
  const cols = await conn.execute(
    `SELECT column_name, data_type, data_length
     FROM all_tab_columns
     WHERE table_name = 'DBUSUARIO' AND column_name LIKE 'VEN_%'
     ORDER BY column_id`
  );
  cols.rows.forEach(r => console.log(r));

  // 2. Ver uma amostra dos valores
  console.log('\n=== AMOSTRA PERMISSÕES VENDA (5 usuários) ===');
  const venCols = cols.rows.map(r => r[0]).join(', ');
  const sample = await conn.execute(
    `SELECT NOMEUSR, ${venCols} FROM DBUSUARIO WHERE ROWNUM <= 5`
  );
  console.log('Colunas:', ['NOMEUSR', ...cols.rows.map(r => r[0])]);
  sample.rows.forEach(r => console.log(r));

  // 3. Ver tabela de funções/siglas (como BPV, MPV, etc)
  console.log('\n=== TABELA DE FUNCOES/SIGLAS ===');
  // Procurar tabelas com "funcao" ou "sigla"
  const funcTables = await conn.execute(
    `SELECT table_name FROM all_tables
     WHERE table_name LIKE '%FUNC%' OR table_name LIKE '%SIGLA%' OR table_name LIKE '%PERM%'
     ORDER BY table_name`
  );
  funcTables.rows.forEach(r => console.log(r));

  // 4. Ver o campo EDITARPRVENDA que vem da procedure
  console.log('\n=== BLOQUEAR_PRVENDA function ===');
  const blkFunc = await conn.execute(
    `SELECT line, text FROM all_source
     WHERE name = 'PRODUTO' AND type = 'PACKAGE BODY'
     AND UPPER(text) LIKE '%BLOQUEAR_PRVENDA%'
     ORDER BY line`
  );
  blkFunc.rows.forEach(r => console.log(r[0], r[1].trim()));

  // Se achou, pegar o corpo
  if (blkFunc.rows.length > 0) {
    const startLine = blkFunc.rows[0][0];
    const body = await conn.execute(
      `SELECT line, text FROM all_source
       WHERE name = 'PRODUTO' AND type = 'PACKAGE BODY'
       AND line >= ${startLine} AND line <= ${startLine + 40}
       ORDER BY line`
    );
    console.log('\n=== CORPO BLOQUEAR_PRVENDA ===');
    body.rows.forEach(r => console.log(r[1]));
  }

  // 5. Como o Next.js gerencia permissões - ver tabela de funções no PG
  console.log('\n=== FUNCOES NO NEXT.JS (PG) ===');
  // Verificar se existe no Oracle
  const funcNext = await conn.execute(
    `SELECT table_name FROM all_tables WHERE table_name LIKE '%USR_FUNC%' OR table_name LIKE '%FUNCAO%' ORDER BY table_name`
  );
  funcNext.rows.forEach(r => console.log(r));

  await conn.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });

const oracledb = require('oracledb');
try { oracledb.initOracleClient(); } catch (e) {}
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

(async () => {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'GERAL', password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br',
    });

    // tabelas relacionadas a referencia de fabrica
    const tabs = await conn.execute(
      `SELECT table_name FROM all_tables
       WHERE owner='GERAL' AND (table_name LIKE '%REF%FAB%' OR table_name LIKE '%FAB%REF%'
             OR table_name LIKE '%PROD%REF%' OR table_name LIKE '%REF_FAB%')
       ORDER BY table_name`,
    );
    console.log('=== TABELAS %REF/FAB% ===');
    console.table(tabs.rows);

    // colunas de dbref_fabrica e dbprod_ref_fabrica (se existirem)
    for (const t of ['DBREF_FABRICA', 'DBPROD_REF_FABRICA']) {
      const cols = await conn.execute(
        `SELECT column_name, data_type FROM all_tab_columns WHERE owner='GERAL' AND table_name=:t ORDER BY column_id`,
        { t },
      );
      console.log(`--- ${t} colunas ---`);
      console.table(cols.rows);
      const cnt = await conn.execute(`SELECT COUNT(*) AS TOTAL FROM GERAL.${t}`).catch((e) => ({ rows: [{ TOTAL: 'ERRO ' + e.message }] }));
      console.log(`${t} total:`, cnt.rows[0].TOTAL);
    }

    // dados do produto 397688
    const links = await conn.execute(
      `SELECT * FROM GERAL.DBPROD_REF_FABRICA WHERE CODPROD = 397688`,
    ).catch((e) => ({ rows: [{ erro: e.message }] }));
    console.log('=== DBPROD_REF_FABRICA codprod 397688 ===');
    console.table(links.rows);
  } catch (e) {
    console.error('ERRO:', e.message);
  } finally {
    if (conn) await conn.close();
  }
})();

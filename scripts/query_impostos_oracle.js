const oracledb = require('oracledb');

async function main() {
  let connection;
  try {
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4'
    });

    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log('\n========================================');
    console.log('BUSCANDO PROCEDURES/FUNCTIONS DE IMPOSTOS');
    console.log('========================================\n');

    // Buscar procedures/functions relacionadas a impostos
    const keywords = ['ICMS', 'IPI', 'PIS', 'COFINS', 'ST', 'IBS', 'CBS', 'IMPOSTO', 'TRIBUTO', 'MVA', 'SUBST'];

    for (const keyword of keywords) {
      console.log(`\n--- Buscando: ${keyword} ---`);

      const result = await connection.execute(
        `SELECT OBJECT_NAME, OBJECT_TYPE, STATUS, CREATED, LAST_DDL_TIME
         FROM USER_OBJECTS
         WHERE (OBJECT_TYPE IN ('PROCEDURE', 'FUNCTION', 'PACKAGE'))
           AND UPPER(OBJECT_NAME) LIKE :keyword
         ORDER BY OBJECT_TYPE, OBJECT_NAME`,
        [`%${keyword}%`]
      );

      if (result.rows && result.rows.length > 0) {
        console.log(`Encontrados ${result.rows.length} objetos:`);
        result.rows.forEach(row => {
          const objName = row[0];
          const objType = row[1];
          const status = row[2];
          const created = row[3];
          console.log(`  - ${objType}: ${objName} (${status}) - Criado: ${created}`);
        });
      } else {
        console.log(`  Nenhum objeto encontrado.`);
      }
    }

    // Buscar tabelas relacionadas
    console.log('\n\n========================================');
    console.log('BUSCANDO TABELAS DE IMPOSTOS/NCM/ALIQUOTAS');
    console.log('========================================\n');

    const tableKeywords = ['ICMS', 'IPI', 'PIS', 'COFINS', 'NCM', 'ALIQ', 'MVA', 'TRIBUT', 'FISCAL', 'CEST'];

    for (const keyword of tableKeywords) {
      const result = await connection.execute(
        `SELECT TABLE_NAME, NUM_ROWS, LAST_ANALYZED
         FROM USER_TABLES
         WHERE UPPER(TABLE_NAME) LIKE :keyword
         ORDER BY TABLE_NAME`,
        [`%${keyword}%`]
      );

      if (result.rows && result.rows.length > 0) {
        console.log(`\n--- Tabelas com "${keyword}": ---`);
        result.rows.forEach(row => {
          const tableName = row[0];
          const numRows = row[1] || 'N/A';
          console.log(`  - ${tableName} (${numRows} linhas)`);
        });
      }
    }

    // Buscar código-fonte das procedures/functions encontradas
    console.log('\n\n========================================');
    console.log('CÓDIGO FONTE DAS PROCEDURES/FUNCTIONS');
    console.log('========================================\n');

    const sourceQuery = await connection.execute(
      `SELECT DISTINCT NAME, TYPE
       FROM USER_SOURCE
       WHERE TYPE IN ('PROCEDURE', 'FUNCTION')
         AND (UPPER(NAME) LIKE '%ICMS%'
           OR UPPER(NAME) LIKE '%IPI%'
           OR UPPER(NAME) LIKE '%PIS%'
           OR UPPER(NAME) LIKE '%COFINS%'
           OR UPPER(NAME) LIKE '%ST%'
           OR UPPER(NAME) LIKE '%MVA%'
           OR UPPER(NAME) LIKE '%IMPOSTO%'
           OR UPPER(NAME) LIKE '%TRIBUTO%')
       ORDER BY TYPE, NAME`
    );

    if (sourceQuery.rows && sourceQuery.rows.length > 0) {
      console.log(`\nEncontradas ${sourceQuery.rows.length} procedures/functions com código:`);

      for (const row of sourceQuery.rows) {
        const objName = row[0];
        const objType = row[1];

        console.log(`\n\n${'='.repeat(80)}`);
        console.log(`${objType}: ${objName}`);
        console.log('='.repeat(80));

        const codeResult = await connection.execute(
          `SELECT TEXT
           FROM USER_SOURCE
           WHERE NAME = :name AND TYPE = :type
           ORDER BY LINE`,
          [objName, objType]
        );

        if (codeResult.rows && codeResult.rows.length > 0) {
          codeResult.rows.forEach(codeRow => {
            process.stdout.write(codeRow[0]);
          });
        }
      }
    }

    await connection.close();
    console.log('\n\n========================================');
    console.log('Consulta finalizada com sucesso!');
    console.log('========================================');
  } catch (err) {
    console.error('ERRO:', err);
    if (connection) {
      try {
        await connection.close();
      } catch (e) {}
    }
    process.exit(1);
  }
}

main();

const oracledb = require('oracledb');
const fs = require('fs');

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

    console.log('Conectado ao Oracle. Extraindo PACKAGE CALCULO_IMPOSTO...\n');

    // Extrair código do PACKAGE SPEC
    const specResult = await connection.execute(
      `SELECT TEXT
       FROM USER_SOURCE
       WHERE NAME = 'CALCULO_IMPOSTO' AND TYPE = 'PACKAGE'
       ORDER BY LINE`
    );

    console.log('========================================');
    console.log('PACKAGE CALCULO_IMPOSTO (SPECIFICATION)');
    console.log('========================================\n');

    let specCode = '';
    if (specResult.rows && specResult.rows.length > 0) {
      specResult.rows.forEach(row => {
        const line = row[0];
        process.stdout.write(line);
        specCode += line;
      });
    }

    // Extrair código do PACKAGE BODY
    const bodyResult = await connection.execute(
      `SELECT TEXT
       FROM USER_SOURCE
       WHERE NAME = 'CALCULO_IMPOSTO' AND TYPE = 'PACKAGE BODY'
       ORDER BY LINE`
    );

    console.log('\n\n========================================');
    console.log('PACKAGE CALCULO_IMPOSTO (BODY)');
    console.log('========================================\n');

    let bodyCode = '';
    if (bodyResult.rows && bodyResult.rows.length > 0) {
      bodyResult.rows.forEach(row => {
        const line = row[0];
        process.stdout.write(line);
        bodyCode += line;
      });
    }

    // Salvar em arquivo
    const outputPath = 'E:\\src\\next\\sistemas\\clones\\melo\\site-melo\\scripts\\oracle_calculo_imposto.sql';
    const fullCode = `-- PACKAGE SPECIFICATION\n${specCode}\n\n-- PACKAGE BODY\n${bodyCode}`;
    fs.writeFileSync(outputPath, fullCode, 'utf8');
    console.log(`\n\nCódigo salvo em: ${outputPath}`);

    // Buscar estrutura de tabelas relacionadas
    console.log('\n\n========================================');
    console.log('ESTRUTURA DAS TABELAS RELACIONADAS');
    console.log('========================================\n');

    const tables = [
      'DBUF_N',
      'DBPROD',
      'DBCLIEN',
      'FIS_TRIBUTO_ALIQUOTA',
      'CAD_LEGISLACAO_ICMSST',
      'CAD_LEGISLACAO_ICMSST_NCM',
      'DBCLASSIFICACAO_FISCAL'
    ];

    for (const tableName of tables) {
      console.log(`\n--- Estrutura da tabela: ${tableName} ---`);

      try {
        const result = await connection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE
           FROM USER_TAB_COLUMNS
           WHERE TABLE_NAME = :tableName
           ORDER BY COLUMN_ID`,
          [tableName]
        );

        if (result.rows && result.rows.length > 0) {
          result.rows.forEach(row => {
            const colName = row[0];
            const dataType = row[1];
            const dataLen = row[2];
            const precision = row[3];
            const scale = row[4];
            const nullable = row[5];

            let typeInfo = dataType;
            if (precision) {
              typeInfo += `(${precision}${scale ? ',' + scale : ''})`;
            } else if (dataLen) {
              typeInfo += `(${dataLen})`;
            }

            console.log(`  ${colName.padEnd(30)} ${typeInfo.padEnd(20)} ${nullable === 'N' ? 'NOT NULL' : ''}`);
          });
        }
      } catch (e) {
        console.log(`  Tabela não encontrada ou erro: ${e.message}`);
      }
    }

    // Buscar views relacionadas a MVA
    console.log('\n\n========================================');
    console.log('VIEWS RELACIONADAS A MVA/NCM');
    console.log('========================================\n');

    const viewResult = await connection.execute(
      `SELECT VIEW_NAME
       FROM USER_VIEWS
       WHERE UPPER(VIEW_NAME) LIKE '%MVA%' OR UPPER(VIEW_NAME) LIKE '%NCM%'
       ORDER BY VIEW_NAME`
    );

    if (viewResult.rows && viewResult.rows.length > 0) {
      console.log('Views encontradas:');
      viewResult.rows.forEach(row => {
        console.log(`  - ${row[0]}`);
      });
    }

    await connection.close();
    console.log('\n\nExtração concluída com sucesso!');
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

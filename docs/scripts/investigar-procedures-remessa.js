const oracledb = require('oracledb');

async function investigarProceduresRemessa() {
  let connection;

  try {
    // Tentar usar o Thick mode (Oracle Instant Client)
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
    }

    // Configuração da conexão
    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    console.log('Conectando ao Oracle...');
    connection = await oracledb.getConnection(config);
    console.log('✅ Conectado com sucesso!\n');

    // 1. Buscar procedures que contém "REMESSA" no nome
    console.log('==========================================');
    console.log('1. PROCEDURES COM "REMESSA" NO NOME');
    console.log('==========================================\n');
    
    const queryProcedures = `
      SELECT 
        object_name,
        object_type,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND UPPER(object_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY object_name
    `;

    const resultProcedures = await connection.execute(queryProcedures);
    
    if (resultProcedures.rows.length > 0) {
      resultProcedures.rows.forEach(row => {
        console.log(`Nome: ${row[0]}`);
        console.log(`Tipo: ${row[1]}`);
        console.log(`Status: ${row[2]}`);
        console.log(`Criado em: ${row[3]}`);
        console.log(`Última modificação: ${row[4]}`);
        console.log('---');
      });
    } else {
      console.log('Nenhuma procedure encontrada com "REMESSA" no nome.');
    }

    // 2. Buscar no código fonte das procedures
    console.log('\n==========================================');
    console.log('2. PROCEDURES COM "REMESSA" NO CÓDIGO');
    console.log('==========================================\n');

    const querySource = `
      SELECT DISTINCT
        name,
        type
      FROM all_source
      WHERE UPPER(text) LIKE '%REMESSA%'
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      ORDER BY name
    `;

    const resultSource = await connection.execute(querySource);
    
    if (resultSource.rows.length > 0) {
      console.log(`Encontradas ${resultSource.rows.length} procedures/funções com "REMESSA" no código:\n`);
      resultSource.rows.forEach(row => {
        console.log(`- ${row[0]} (${row[1]})`);
      });
    } else {
      console.log('Nenhuma procedure encontrada com "REMESSA" no código.');
    }

    // 3. Buscar especificamente por procedures relacionadas a CNAB
    console.log('\n==========================================');
    console.log('3. PROCEDURES COM "CNAB" NO CÓDIGO');
    console.log('==========================================\n');

    const queryCNAB = `
      SELECT DISTINCT
        name,
        type
      FROM all_source
      WHERE (UPPER(text) LIKE '%CNAB%' OR UPPER(text) LIKE '%BOLETO%')
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      ORDER BY name
    `;

    const resultCNAB = await connection.execute(queryCNAB);
    
    if (resultCNAB.rows.length > 0) {
      console.log(`Encontradas ${resultCNAB.rows.length} procedures/funções com "CNAB" ou "BOLETO":\n`);
      resultCNAB.rows.forEach(row => {
        console.log(`- ${row[0]} (${row[1]})`);
      });
    }

    // 4. Buscar tabelas relacionadas a remessa
    console.log('\n==========================================');
    console.log('4. TABELAS COM "REMESSA" NO NOME');
    console.log('==========================================\n');

    const queryTables = `
      SELECT 
        table_name,
        num_rows,
        last_analyzed
      FROM all_tables
      WHERE UPPER(table_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY table_name
    `;

    const resultTables = await connection.execute(queryTables);
    
    if (resultTables.rows.length > 0) {
      resultTables.rows.forEach(row => {
        console.log(`Tabela: ${row[0]}`);
        console.log(`Linhas: ${row[1] || 'N/A'}`);
        console.log(`Última análise: ${row[2] || 'N/A'}`);
        console.log('---');
      });
    } else {
      console.log('Nenhuma tabela encontrada com "REMESSA" no nome.');
    }

    // 5. Se encontrou procedures, pegar o código fonte das principais
    console.log('\n==========================================');
    console.log('5. CÓDIGO FONTE DAS PROCEDURES DE REMESSA');
    console.log('==========================================\n');

    if (resultProcedures.rows.length > 0) {
      for (const row of resultProcedures.rows) {
        const procName = row[0];
        console.log(`\n--- CÓDIGO DE ${procName} ---\n`);

        const queryCode = `
          SELECT text
          FROM all_source
          WHERE name = :procName
            AND owner = 'GERAL'
          ORDER BY line
        `;

        const resultCode = await connection.execute(queryCode, [procName]);
        
        if (resultCode.rows.length > 0) {
          resultCode.rows.forEach(codeRow => {
            process.stdout.write(codeRow[0]);
          });
          console.log('\n');
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.errorNum) {
      console.error('Código do erro:', error.errorNum);
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Conexão fechada.');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

investigarProceduresRemessa();

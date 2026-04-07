import oracledb from 'oracledb';

// Configurar para modo thick (requer Oracle Instant Client instalado)
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err.message);
}

async function consultarProceduresContasReceber() {
  let connection;

  try {
    // Conectar ao banco Oracle usando as credenciais do .env
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log('Conectado ao Oracle com sucesso!');

    // Consultar procedures relacionadas a contas a receber
    const sql = `
      SELECT OWNER, OBJECT_NAME, PROCEDURE_NAME, OBJECT_TYPE
      FROM ALL_PROCEDURES
      WHERE (OBJECT_NAME LIKE '%RECEBER%' OR OBJECT_NAME LIKE '%CONTAS%' OR OBJECT_NAME LIKE '%COBRANCA%')
      AND OBJECT_TYPE = 'PROCEDURE'
      ORDER BY OWNER, OBJECT_NAME
    `;

    const result = await connection.execute(sql);

    console.log('\n=== PROCEDURES RELACIONADAS A CONTAS A RECEBER ===\n');
    console.log('OWNER | OBJECT_NAME | PROCEDURE_NAME | OBJECT_TYPE');
    console.log('------|-------------|----------------|------------');

    if (result.rows.length === 0) {
      console.log('Nenhuma procedure encontrada com os critérios especificados.');
    } else {
      result.rows.forEach(row => {
        console.log(`${row[0]} | ${row[1]} | ${row[2] || '(N/A)'} | ${row[3]}`);
      });
    }

    // Também consultar packages que podem conter procedures
    const sqlPackages = `
      SELECT OWNER, OBJECT_NAME, OBJECT_TYPE
      FROM ALL_OBJECTS
      WHERE OBJECT_TYPE IN ('PACKAGE', 'PACKAGE BODY')
      AND (OBJECT_NAME LIKE '%RECEBER%' OR OBJECT_NAME LIKE '%CONTAS%' OR OBJECT_NAME LIKE '%COBRANCA%')
      ORDER BY OWNER, OBJECT_NAME
    `;

    const resultPackages = await connection.execute(sqlPackages);

    console.log('\n=== PACKAGES RELACIONADAS A CONTAS A RECEBER ===\n');
    console.log('OWNER | OBJECT_NAME | OBJECT_TYPE');
    console.log('------|-------------|------------');

    if (resultPackages.rows.length === 0) {
      console.log('Nenhum package encontrado com os critérios especificados.');
    } else {
      resultPackages.rows.forEach(row => {
        console.log(`${row[0]} | ${row[1]} | ${row[2]}`);
      });
    }

    // Consultar tabelas relacionadas
    const sqlTables = `
      SELECT OWNER, TABLE_NAME
      FROM ALL_TABLES
      WHERE TABLE_NAME LIKE '%RECEBER%' OR TABLE_NAME LIKE '%CONTAS%' OR TABLE_NAME LIKE '%COBRANCA%'
      ORDER BY OWNER, TABLE_NAME
    `;

    const resultTables = await connection.execute(sqlTables);

    console.log('\n=== TABELAS RELACIONADAS A CONTAS A RECEBER ===\n');
    console.log('OWNER | TABLE_NAME');
    console.log('------|------------');

    if (resultTables.rows.length === 0) {
      console.log('Nenhuma tabela encontrada com os critérios especificados.');
    } else {
      resultTables.rows.forEach(row => {
        console.log(`${row[0]} | ${row[1]}`);
      });
    }

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\nConexão fechada.');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

// Executar a consulta
consultarProceduresContasReceber();
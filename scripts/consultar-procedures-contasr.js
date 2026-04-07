import oracledb from 'oracledb';

async function consultarProceduresContasR() {
  let connection;

  try {
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
    }

    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    console.log('\n🔍 Conectando ao Oracle...');

    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    connection = await oracledb.getConnection(config);

    console.log('✅ Conectado ao Oracle com sucesso!\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 CÓDIGO FONTE DO PACOTE CONTASR');
    console.log('═══════════════════════════════════════════════════════\n');

    // Consultar o código fonte do pacote CONTASR
    const packageSource = await connection.execute(`
      SELECT
        NAME,
        TYPE,
        LINE,
        TEXT
      FROM USER_SOURCE
      WHERE NAME = 'CONTASR'
        AND TYPE IN ('PACKAGE', 'PACKAGE BODY')
      ORDER BY TYPE, LINE
    `);

    if (packageSource.rows.length > 0) {
      console.log(`Código fonte encontrado: ${packageSource.rows.length} linhas\n`);

      let currentType = '';
      packageSource.rows.forEach(row => {
        if (row.TYPE !== currentType) {
          console.log(`\n=== ${row.TYPE} ===\n`);
          currentType = row.TYPE;
        }
        const lineNum = String(row.LINE).padStart(4, ' ');
        console.log(`${lineNum}: ${row.TEXT}`);
      });
    } else {
      console.log('⚠️  Código fonte do pacote CONTASR não encontrado');
    }

    // Também consultar procedures específicas do CONTASR se existirem separadamente
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('⚙️  PROCEDURES INDIVIDUAIS DO CONTASR');
    console.log('═══════════════════════════════════════════════════════\n');

    const individualProcedures = await connection.execute(`
      SELECT
        OBJECT_NAME,
        OBJECT_TYPE,
        STATUS
      FROM USER_OBJECTS
      WHERE OBJECT_NAME LIKE 'CONTASR_%'
        AND OBJECT_TYPE = 'PROCEDURE'
      ORDER BY OBJECT_NAME
    `);

    console.log('Procedures encontradas:', individualProcedures.rows.length);
    if (individualProcedures.rows.length > 0) {
      console.log('\nNOME                          | STATUS');
      console.log('------------------------------|--------');
      individualProcedures.rows.forEach(row => {
        const name = (row.OBJECT_NAME || '').padEnd(29);
        const status = row.STATUS || '';
        console.log(`${name} | ${status}`);
      });

      // Mostrar código fonte das primeiras 3 procedures
      console.log('\n📝 CÓDIGO DAS PRIMEIRAS PROCEDURES:\n');

      for (let i = 0; i < Math.min(3, individualProcedures.rows.length); i++) {
        const procName = individualProcedures.rows[i].OBJECT_NAME;
        console.log(`\n--- ${procName} ---\n`);

        const procSource = await connection.execute(`
          SELECT TEXT
          FROM USER_SOURCE
          WHERE NAME = :procName
            AND TYPE = 'PROCEDURE'
          ORDER BY LINE
        `, [procName]);

        if (procSource.rows.length > 0) {
          procSource.rows.forEach((row, index) => {
            const lineNum = String(index + 1).padStart(3, ' ');
            console.log(`${lineNum}: ${row.TEXT}`);
          });
        } else {
          console.log('Código não encontrado');
        }
      }
    }

    console.log('\n✅ Consulta concluída com sucesso!');

  } catch (err) {
    console.error('\n❌ Erro durante a consulta:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n🔌 Conexão fechada');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

// Executar
consultarProceduresContasR()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Erro fatal:', err);
    process.exit(1);
  });
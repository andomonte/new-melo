const oracledb = require('oracledb');

async function verificarDBRECEB() {
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
    console.log('📋 ESTRUTURA DA TABELA DBRECEB (Contas a Receber)');
    console.log('═══════════════════════════════════════════════════════\n');

    const colunas = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        DATA_PRECISION,
        DATA_SCALE,
        NULLABLE
      FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'DBRECEB'
      ORDER BY COLUMN_ID
    `);

    console.log('Colunas encontradas:', colunas.rows.length);
    console.log('\nCOLUNA                | TIPO         | TAMANHO | PRECISÃO | ESCALA | ANULÁVEL');
    console.log('----------------------|--------------|---------|----------|--------|----------');
    colunas.rows.forEach(row => {
      const col = (row.COLUMN_NAME || '').padEnd(21);
      const type = (row.DATA_TYPE || '').padEnd(12);
      const len = String(row.DATA_LENGTH || '').padEnd(7);
      const prec = String(row.DATA_PRECISION || '-').padEnd(8);
      const scale = String(row.DATA_SCALE || '-').padEnd(6);
      const nullable = row.NULLABLE || '';
      console.log(`${col} | ${type} | ${len} | ${prec} | ${scale} | ${nullable}`);
    });

    // 2. Verificar procedures relacionadas a DBRECEB
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('⚙️  PROCEDURES RELACIONADAS A RECEBIMENTO');
    console.log('═══════════════════════════════════════════════════════\n');

    const procedures = await connection.execute(`
      SELECT 
        OBJECT_NAME,
        OBJECT_TYPE,
        STATUS,
        TO_CHAR(CREATED, 'DD/MM/YYYY') AS CREATED,
        TO_CHAR(LAST_DDL_TIME, 'DD/MM/YYYY HH24:MI') AS LAST_DDL_TIME
      FROM USER_OBJECTS
      WHERE OBJECT_TYPE IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (
          UPPER(OBJECT_NAME) LIKE '%RECEB%'
          OR UPPER(OBJECT_NAME) LIKE '%CONTAS%R%'
          OR UPPER(OBJECT_NAME) LIKE '%TITULO%'
        )
      ORDER BY OBJECT_TYPE, OBJECT_NAME
    `);

    console.log('Procedures encontradas:', procedures.rows.length);
    if (procedures.rows.length > 0) {
      console.log('\nNOME                          | TIPO      | STATUS   | CRIADO     | ÚLTIMA MODIFICAÇÃO');
      console.log('------------------------------|-----------|----------|------------|-------------------');
      procedures.rows.forEach(row => {
        const name = (row.OBJECT_NAME || '').padEnd(29);
        const type = (row.OBJECT_TYPE || '').padEnd(9);
        const status = (row.STATUS || '').padEnd(8);
        const created = (row.CREATED || '').padEnd(10);
        const modified = row.LAST_DDL_TIME || '';
        console.log(`${name} | ${type} | ${status} | ${created} | ${modified}`);
      });
    }

    // 3. Verificar tabelas relacionadas
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🗃️  TABELAS RELACIONADAS A RECEBIMENTO');
    console.log('═══════════════════════════════════════════════════════\n');

    const tabelas = await connection.execute(`
      SELECT 
        TABLE_NAME,
        NUM_ROWS,
        TO_CHAR(LAST_ANALYZED, 'DD/MM/YYYY') AS LAST_ANALYZED
      FROM USER_TABLES
      WHERE TABLE_NAME LIKE '%RECEB%'
         OR TABLE_NAME LIKE '%FRECEB%'
         OR TABLE_NAME = 'DBCLIEN'
         OR TABLE_NAME = 'DBCONTA'
         OR TABLE_NAME = 'DBVEND'
      ORDER BY TABLE_NAME
    `);

    console.log('Tabelas encontradas:', tabelas.rows.length);
    if (tabelas.rows.length > 0) {
      console.log('\nTABELA                    | LINHAS     | ÚLTIMA ANÁLISE');
      console.log('--------------------------|------------|---------------');
      tabelas.rows.forEach(row => {
        const table = (row.TABLE_NAME || '').padEnd(25);
        const rows = String(row.NUM_ROWS || 0).padEnd(10);
        const analyzed = row.LAST_ANALYZED || '-';
        console.log(`${table} | ${rows} | ${analyzed}`);
      });
    }

    // 4. Verificar constraints e chaves estrangeiras
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔗 CONSTRAINTS DA TABELA DBRECEB');
    console.log('═══════════════════════════════════════════════════════\n');

    const constraints = await connection.execute(`
      SELECT 
        c.CONSTRAINT_NAME,
        c.CONSTRAINT_TYPE,
        c.SEARCH_CONDITION,
        cc.COLUMN_NAME,
        c.R_CONSTRAINT_NAME
      FROM USER_CONSTRAINTS c
      LEFT JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
      WHERE c.TABLE_NAME = 'DBRECEB'
      ORDER BY c.CONSTRAINT_TYPE, c.CONSTRAINT_NAME
    `);

    console.log('Constraints encontradas:', constraints.rows.length);
    if (constraints.rows.length > 0) {
      console.log('\nNOME                      | TIPO | COLUNA           | REFERÊNCIA');
      console.log('--------------------------|------|------------------|------------------');
      constraints.rows.forEach(row => {
        const name = (row.CONSTRAINT_NAME || '').substring(0, 25).padEnd(25);
        const type = (row.CONSTRAINT_TYPE || '').padEnd(4);
        const col = (row.COLUMN_NAME || '').padEnd(16);
        const ref = row.R_CONSTRAINT_NAME || '-';
        console.log(`${name} | ${type} | ${col} | ${ref}`);
      });
    }

    // 5. Buscar exemplo de dados (5 primeiras linhas)
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 EXEMPLO DE DADOS (5 primeiras linhas)');
    console.log('═══════════════════════════════════════════════════════\n');

    const dados = await connection.execute(`
      SELECT * FROM DBRECEB WHERE ROWNUM <= 5 ORDER BY COD_RECEB DESC
    `);

    if (dados.rows.length > 0) {
      console.log('Exemplo de registro (primeiro):');
      console.log(JSON.stringify(dados.rows[0], null, 2));
    } else {
      console.log('⚠️  Nenhum registro encontrado na tabela DBRECEB');
    }

    // 6. Verificar estrutura da DBFRECEB (histórico de recebimentos)
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 ESTRUTURA DA TABELA DBFRECEB (Histórico Recebimentos)');
    console.log('═══════════════════════════════════════════════════════\n');

    const colunasHistorico = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE
      FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'DBFRECEB'
      ORDER BY COLUMN_ID
    `);

    if (colunasHistorico.rows.length > 0) {
      console.log('Colunas encontradas:', colunasHistorico.rows.length);
      console.log('\nCOLUNA                | TIPO         | TAMANHO | ANULÁVEL');
      console.log('----------------------|--------------|---------|----------');
      colunasHistorico.rows.forEach(row => {
        const col = (row.COLUMN_NAME || '').padEnd(21);
        const type = (row.DATA_TYPE || '').padEnd(12);
        const len = String(row.DATA_LENGTH || '').padEnd(7);
        const nullable = row.NULLABLE || '';
        console.log(`${col} | ${type} | ${len} | ${nullable}`);
      });
    } else {
      console.log('⚠️  Tabela DBFRECEB não encontrada');
    }

    // 7. Verificar índices
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 ÍNDICES DA TABELA DBRECEB');
    console.log('═══════════════════════════════════════════════════════\n');

    const indices = await connection.execute(`
      SELECT 
        i.INDEX_NAME,
        i.INDEX_TYPE,
        i.UNIQUENESS,
        ic.COLUMN_NAME,
        ic.COLUMN_POSITION
      FROM USER_INDEXES i
      JOIN USER_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME
      WHERE i.TABLE_NAME = 'DBRECEB'
      ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION
    `);

    console.log('Índices encontrados:', indices.rows.length);
    if (indices.rows.length > 0) {
      console.log('\nÍNDICE                    | TIPO         | ÚNICO     | COLUNA           | POS');
      console.log('--------------------------|--------------|-----------|------------------|----');
      indices.rows.forEach(row => {
        const idx = (row.INDEX_NAME || '').substring(0, 25).padEnd(25);
        const type = (row.INDEX_TYPE || '').padEnd(12);
        const unique = (row.UNIQUENESS || '').padEnd(9);
        const col = (row.COLUMN_NAME || '').padEnd(16);
        const pos = row.COLUMN_POSITION || '';
        console.log(`${idx} | ${type} | ${unique} | ${col} | ${pos}`);
      });
    }

    // 8. Verificar source de uma procedure específica (se existir)
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📝 SOURCE DE PROCEDURES DE RECEBIMENTO');
    console.log('═══════════════════════════════════════════════════════\n');

    const procedureSource = await connection.execute(`
      SELECT 
        NAME,
        TYPE,
        LINE,
        TEXT
      FROM USER_SOURCE
      WHERE (NAME LIKE '%NAVEGA_CONTAS%R%' OR NAME LIKE '%INC_CONTAS%R%' OR NAME LIKE '%ALT_CONTAS%R%')
        AND TYPE = 'PROCEDURE'
        AND ROWNUM <= 50
      ORDER BY NAME, LINE
    `);

    if (procedureSource.rows.length > 0) {
      console.log('Primeiras 50 linhas de código encontradas:\n');
      let lastProc = '';
      procedureSource.rows.forEach(row => {
        if (row.NAME !== lastProc) {
          console.log(`\n--- ${row.NAME} (${row.TYPE}) ---`);
          lastProc = row.NAME;
        }
        console.log(`${String(row.LINE).padStart(3)}: ${row.TEXT}`);
      });
    } else {
      console.log('⚠️  Nenhuma procedure específica encontrada');
    }

    console.log('\n✅ Análise concluída com sucesso!');

  } catch (err) {
    console.error('\n❌ Erro durante a análise:', err);
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
verificarDBRECEB()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Erro fatal:', err);
    process.exit(1);
  });

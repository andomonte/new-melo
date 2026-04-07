const oracledb = require('oracledb');

async function verificarEstruturaOracle() {
  let connection;
  
  try {
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
    }

    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    console.log('🔍 Conectando no Oracle do cliente...\n');

    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    connection = await oracledb.getConnection(config);

    console.log('✅ Conectado!\n');

    // 1. Verificar estrutura da tabela DBRECEB (campos relacionados a banco)
    console.log('📋 Estrutura dos campos de banco em DBRECEB:\n');
    
    const resultColunas = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE
      FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'DBRECEB'
        AND COLUMN_NAME LIKE '%BANCO%'
      ORDER BY COLUMN_ID
    `);

    console.log('COLUNA              | TIPO         | TAMANHO | NULLABLE');
    console.log('--------------------|--------------|---------|----------');
    resultColunas.rows.forEach(row => {
      const col = (row.COLUMN_NAME || '').padEnd(19);
      const type = (row.DATA_TYPE || '').padEnd(12);
      const len = String(row.DATA_LENGTH || '').padEnd(7);
      const nullable = row.NULLABLE || '';
      console.log(`${col} | ${type} | ${len} | ${nullable}`);
    });

    // 2. Verificar estrutura da tabela DBBANCO
    console.log('\n📋 Estrutura completa da tabela DBBANCO:\n');
    
    const resultBanco = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE
      FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'DBBANCO'
      ORDER BY COLUMN_ID
    `);

    console.log('COLUNA              | TIPO         | TAMANHO | NULLABLE');
    console.log('--------------------|--------------|---------|----------');
    resultBanco.rows.forEach(row => {
      const col = (row.COLUMN_NAME || '').padEnd(19);
      const type = (row.DATA_TYPE || '').padEnd(12);
      const len = String(row.DATA_LENGTH || '').padEnd(7);
      const nullable = row.NULLABLE || '';
      console.log(`${col} | ${type} | ${len} | ${nullable}`);
    });

    // 3. Verificar sample de dados da DBBANCO
    console.log('\n📊 Sample de bancos cadastrados no Oracle:\n');
    
    const resultSample = await connection.execute(`
      SELECT 
        COD_BANCO,
        COD_BC,
        NOME,
        N_AGENCIA
      FROM DBBANCO
      WHERE ROWNUM <= 10
      ORDER BY COD_BANCO
    `);

    console.log('COD_BANCO | COD_BC | NOME                              | AGÊNCIA');
    console.log('----------|--------|-----------------------------------|----------');
    resultSample.rows.forEach(row => {
      const cod = (row.COD_BANCO || '').padEnd(9);
      const codBc = (row.COD_BC || '').padEnd(6);
      const nome = (row.NOME || '').substring(0, 33).padEnd(33);
      const agencia = (row.N_AGENCIA || '').padEnd(8);
      console.log(`${cod} | ${codBc} | ${nome} | ${agencia}`);
    });

    // 4. Verificar distribuição de títulos por banco no Oracle
    console.log('\n📊 Distribuição de títulos por banco no Oracle:\n');
    
    const resultDist = await connection.execute(`
      SELECT 
        BANCO,
        COUNT(*) as QTD
      FROM DBRECEB
      WHERE FORMA_FAT = '2'
        AND ROWNUM <= 1000
      GROUP BY BANCO
      ORDER BY COUNT(*) DESC
    `);

    console.log('BANCO | QTD TÍTULOS');
    console.log('------|------------');
    resultDist.rows.forEach(row => {
      const banco = (row.BANCO || 'NULL').padEnd(5);
      const qtd = String(row.QTD).padStart(11);
      console.log(`${banco} | ${qtd}`);
    });

    // 5. Verificar como é feito o JOIN no Oracle (procedure SELECIONA_REMESSA)
    console.log('\n🔍 Verificando procedure SELECIONA_REMESSA:\n');
    
    const resultProc = await connection.execute(`
      SELECT TEXT
      FROM USER_SOURCE
      WHERE NAME = 'SELECIONA_REMESSA'
        AND TYPE = 'PROCEDURE'
      ORDER BY LINE
    `);

    if (resultProc.rows.length > 0) {
      console.log('Código da procedure:\n');
      resultProc.rows.forEach(row => {
        console.log(row.TEXT);
      });
    } else {
      console.log('⚠️ Procedure SELECIONA_REMESSA não encontrada');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Conexão fechada');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

verificarEstruturaOracle();

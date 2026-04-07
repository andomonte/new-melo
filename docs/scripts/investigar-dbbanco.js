const oracledb = require('oracledb');

async function getOracleConnection() {
 try {
        oracledb.initOracleClient();
      } catch (err) {
        console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
      }
  
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  
      // Configuração da conexão
       const config = {
        user: 'GERAL',
        password: '123',
        connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
      };

  console.log('Conectando ao Oracle...');
  return await oracledb.getConnection(config);
}

async function investigarDBBanco() {
  let connection;
  
  try {
    connection = await getOracleConnection();
    console.log('✅ Conectado ao Oracle\n');
    console.log('============================================');
    console.log('INVESTIGAÇÃO: TABELA DBBANCO');
    console.log('============================================\n');

    // 1. Estrutura da tabela
    console.log('1. ESTRUTURA DA TABELA DBBANCO:');
    console.log('-------------------------------');
    const estruturaQuery = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL' 
        AND table_name = 'DBBANCO'
      ORDER BY column_id
    `;
    
    const estrutura = await connection.execute(estruturaQuery);
    
    if (estrutura.rows.length > 0) {
      console.log('Colunas da DBBANCO:');
      estrutura.rows.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}(${col.DATA_LENGTH}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
      });
    }

    // 2. Todos os registros
    console.log('\n2. TODOS OS BANCOS CADASTRADOS:');
    console.log('--------------------------------');
    const bancosQuery = `
      SELECT *
      FROM GERAL.DBBANCO
      ORDER BY COD_BANCO
    `;
    
    const bancos = await connection.execute(bancosQuery);
    console.log(`\nRegistros encontrados: ${bancos.rows.length}\n`);
    
    bancos.rows.forEach((banco, index) => {
      console.log(`--- Banco ${index + 1} ---`);
      Object.entries(banco).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      console.log('');
    });

    // 3. Relação com DBCONTA
    console.log('3. BANCOS UTILIZADOS EM DBCONTA:');
    console.log('---------------------------------');
    const usadosQuery = `
      SELECT 
        b.COD_BANCO,
        b.NOME,
        b.COD_BC,
        COUNT(DISTINCT c.COD_CONTA) as TOTAL_CONTAS
      FROM GERAL.DBBANCO b
      LEFT JOIN GERAL.DBCONTA c ON c.COD_BANCO = b.COD_BANCO
      GROUP BY b.COD_BANCO, b.NOME, b.COD_BC
      HAVING COUNT(DISTINCT c.COD_CONTA) > 0
      ORDER BY TOTAL_CONTAS DESC, b.COD_BANCO
    `;
    
    const usados = await connection.execute(usadosQuery);
    console.log(`\nBancos com contas ativas:\n`);
    usados.rows.forEach(row => {
      console.log(`  ${row.COD_BANCO.padEnd(6)} (BC ${row.COD_BC.padEnd(4)}) - ${row.NOME.substring(0,40).padEnd(40)} (${row.TOTAL_CONTAS} contas)`);
    });

    // 4. Bancos usados em DBPGTO
    console.log('\n4. BANCOS UTILIZADOS EM DBPGTO:');
    console.log('--------------------------------');
    const pgtoQuery = `
      SELECT 
        BANCO,
        COUNT(*) as TOTAL_PAGAMENTOS
      FROM GERAL.DBPGTO_ENT
      WHERE BANCO IS NOT NULL 
      GROUP BY BANCO
      ORDER BY TOTAL_PAGAMENTOS DESC
      FETCH FIRST 20 ROWS ONLY
    `;
    
    const pgtos = await connection.execute(pgtoQuery);
    console.log(`\nBancos mais utilizados em pagamentos:\n`);
    pgtos.rows.forEach(row => {
      console.log(`  ${row.BANCO.padEnd(10)} - ${row.TOTAL_PAGAMENTOS} pagamentos`);
    });

    console.log('\n============================================');
    console.log('RECOMENDAÇÕES:');
    console.log('============================================');
    console.log('1. A tabela DBBANCO contém os bancos oficiais do sistema');
    console.log('2. Use cod_banco como value e nome_banco como label no dropdown');
    console.log('3. Filtre apenas bancos que têm contas ativas (oficial = "S")');
    console.log('4. O campo "banco" em DBPGTO pode não seguir os códigos de DBBANCO');
    console.log('5. Considere normalizar dados históricos para usar cod_banco padrão');
    console.log('============================================\n');

  } catch (error) {
    console.error('❌ Erro na investigação:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

investigarDBBanco();

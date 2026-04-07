import oracledb from 'oracledb';
import dotenv from 'dotenv';
dotenv.config();

// Adicionar Oracle Instant Client ao PATH antes de inicializar
const instantClientPath = 'C:\\oracle\\instantclient_23_8';
process.env.PATH = instantClientPath + ';' + process.env.PATH;
console.log('✅ Oracle Instant Client adicionado ao PATH');

// FORÇAR modo Thick antes de qualquer conexão
try {
  oracledb.initOracleClient({
    libDir: instantClientPath,
  });
  console.log('✅ Oracle Instant Client inicializado em modo Thick');
} catch (err) {
  if (err.message.includes('already been initialized')) {
    console.log('✅ Oracle Instant Client já está em modo Thick');
  } else {
    console.error('❌ Erro ao inicializar Oracle Client:', err.message);
    process.exit(1);
  }
}

async function consultarRemessaRetorno() {
  let connection;

  try {
    // Configuração da conexão Oracle usando as variáveis de ambiente
    const connectString = `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE}`;
    
    console.log(`🔌 Conectando ao Oracle: ${connectString}`);
    
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: connectString
    });

    console.log('✅ Conectado ao Oracle Database');

    // =====================================================
    // 1. CONSULTAR PROCEDURES/FUNCTIONS RELACIONADAS A REMESSA
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 1. PROCEDURES/FUNCTIONS RELACIONADAS A REMESSA E RETORNO BANCÁRIO');
    console.log('='.repeat(80));

    const queryProceduresRemessa = `
      SELECT 
        object_name,
        object_type,
        owner,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
        AND (
          UPPER(object_name) LIKE '%REMESSA%'
          OR UPPER(object_name) LIKE '%RETORNO%'
          OR UPPER(object_name) LIKE '%CNAB%'
          OR UPPER(object_name) LIKE '%BOLETO%'
          OR UPPER(object_name) LIKE '%COBRANCA%'
          OR UPPER(object_name) LIKE '%BANCO%'
          OR UPPER(object_name) LIKE '%BANCARIO%'
          OR UPPER(object_name) LIKE '%240%'
          OR UPPER(object_name) LIKE '%400%'
          OR UPPER(object_name) LIKE '%FEBRABAN%'
        )
      ORDER BY object_type, object_name
    `;

    const resultRemessa = await connection.execute(queryProceduresRemessa);

    if (resultRemessa.rows && resultRemessa.rows.length > 0) {
      console.log(`\nEncontrados ${resultRemessa.rows.length} objetos:\n`);
      
      resultRemessa.rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(3)}. [${row[1]}] ${row[0]}`);
        console.log(`     Owner: ${row[2]} | Status: ${row[3]} | Modificado: ${row[5]}`);
      });
    } else {
      console.log('❌ Nenhuma procedure/function relacionada encontrada.');
    }

    // =====================================================
    // 2. CONSULTAR TABELAS RELACIONADAS A REMESSA/RETORNO
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 2. TABELAS RELACIONADAS A REMESSA E RETORNO');
    console.log('='.repeat(80));

    const queryTabelasRemessa = `
      SELECT 
        table_name,
        owner,
        num_rows,
        last_analyzed
      FROM all_tables
      WHERE (
          UPPER(table_name) LIKE '%REMESSA%'
          OR UPPER(table_name) LIKE '%RETORNO%'
          OR UPPER(table_name) LIKE '%CNAB%'
          OR UPPER(table_name) LIKE '%ARQ_BANCO%'
          OR UPPER(table_name) LIKE '%ARQUIVO_BANCO%'
          OR UPPER(table_name) LIKE '%LOG_BANCO%'
        )
      ORDER BY table_name
    `;

    const resultTabelas = await connection.execute(queryTabelasRemessa);

    if (resultTabelas.rows && resultTabelas.rows.length > 0) {
      console.log(`\nEncontradas ${resultTabelas.rows.length} tabelas:\n`);
      
      resultTabelas.rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(3)}. ${row[0]}`);
        console.log(`     Owner: ${row[1]} | Registros: ${row[2] || 'N/A'} | Última análise: ${row[3] || 'N/A'}`);
      });
    } else {
      console.log('❌ Nenhuma tabela específica de remessa/retorno encontrada.');
    }

    // =====================================================
    // 3. BUSCAR CÓDIGO FONTE DAS PRINCIPAIS PROCEDURES
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📄 3. CÓDIGO FONTE DAS PROCEDURES DE REMESSA/RETORNO');
    console.log('='.repeat(80));

    // Buscar procedures específicas relacionadas a remessa
    const proceduresParaBuscar = [
      'SELECIONA_REMESSA',
      'GERA_REMESSA',
      'PROCESSA_RETORNO',
      'IMPORTA_RETORNO',
      'LE_RETORNO',
      'RETORNO_BANCO',
      'REMESSA_BANCO',
      'ATUALIZA_RETORNO',
      'BAIXA_RETORNO'
    ];

    for (const procName of proceduresParaBuscar) {
      const querySource = `
        SELECT text 
        FROM all_source 
        WHERE UPPER(name) LIKE '%${procName}%'
          AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE BODY')
        ORDER BY name, type, line
      `;

      try {
        const sourceResult = await connection.execute(querySource);

        if (sourceResult.rows && sourceResult.rows.length > 0) {
          console.log(`\n\n--- Encontrado: ${procName} ---`);
          console.log('-'.repeat(60));
          
          // Limitar a 100 linhas para não sobrecarregar
          const linhas = sourceResult.rows.slice(0, 100);
          linhas.forEach(srcRow => {
            process.stdout.write(srcRow[0]);
          });
          
          if (sourceResult.rows.length > 100) {
            console.log(`\n... (${sourceResult.rows.length - 100} linhas omitidas)`);
          }
          console.log('\n--- FIM ---');
        }
      } catch (err) {
        // Silenciar erros de procedure não encontrada
      }
    }

    // =====================================================
    // 4. BUSCAR PACKAGES RELACIONADOS A BANCO/COBRANÇA
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📦 4. PACKAGES RELACIONADOS A OPERAÇÕES BANCÁRIAS');
    console.log('='.repeat(80));

    const queryPackages = `
      SELECT 
        object_name,
        object_type,
        owner,
        status
      FROM all_objects
      WHERE object_type IN ('PACKAGE', 'PACKAGE BODY')
        AND (
          UPPER(object_name) LIKE '%COB%'
          OR UPPER(object_name) LIKE '%BANCO%'
          OR UPPER(object_name) LIKE '%TITULO%'
          OR UPPER(object_name) LIKE '%RECEB%'
          OR UPPER(object_name) LIKE '%FIN%'
        )
      ORDER BY object_name, object_type
    `;

    const resultPackages = await connection.execute(queryPackages);

    if (resultPackages.rows && resultPackages.rows.length > 0) {
      console.log(`\nEncontrados ${resultPackages.rows.length} packages:\n`);
      
      resultPackages.rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(3)}. [${row[1]}] ${row[0]}`);
        console.log(`     Owner: ${row[2]} | Status: ${row[3]}`);
      });
    } else {
      console.log('❌ Nenhum package encontrado.');
    }

    // =====================================================
    // 5. VERIFICAR ESTRUTURA DE TABELAS DE RECEBIMENTOS (DBRECEB)
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('🏦 5. CAMPOS RELACIONADOS A REMESSA/RETORNO EM DBRECEB');
    console.log('='.repeat(80));

    const queryCamposRemessa = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        DATA_LENGTH,
        NULLABLE,
        DATA_DEFAULT
      FROM all_tab_columns
      WHERE UPPER(table_name) = 'DBRECEB'
        AND (
          UPPER(column_name) LIKE '%REMESSA%'
          OR UPPER(column_name) LIKE '%RETORNO%'
          OR UPPER(column_name) LIKE '%NOSSO%'
          OR UPPER(column_name) LIKE '%BANCO%'
          OR UPPER(column_name) LIKE '%BAIXA%'
          OR UPPER(column_name) LIKE '%SITUACAO%'
          OR UPPER(column_name) LIKE '%STATUS%'
        )
      ORDER BY column_name
    `;

    const resultCampos = await connection.execute(queryCamposRemessa);

    if (resultCampos.rows && resultCampos.rows.length > 0) {
      console.log(`\nEncontrados ${resultCampos.rows.length} campos relevantes:\n`);
      console.log('COLUNA                    | TIPO         | TAMANHO | NULLABLE | DEFAULT');
      console.log('--------------------------|--------------|---------|----------|--------');
      
      resultCampos.rows.forEach(row => {
        const col = (row[0] || '').padEnd(25);
        const tipo = (row[1] || '').padEnd(12);
        const tam = String(row[2] || '').padEnd(7);
        const nullable = (row[3] || '').padEnd(8);
        const def = (row[4] || 'N/A').toString().substring(0, 20);
        console.log(`${col} | ${tipo} | ${tam} | ${nullable} | ${def}`);
      });
    } else {
      console.log('❌ Nenhum campo específico encontrado.');
    }

    // =====================================================
    // 6. VERIFICAR SE EXISTE TABELA DE LOG/HISTÓRICO DE REMESSA
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📝 6. TABELAS DE LOG/HISTÓRICO DE OPERAÇÕES BANCÁRIAS');
    console.log('='.repeat(80));

    const queryLogTables = `
      SELECT 
        table_name,
        owner,
        num_rows
      FROM all_tables
      WHERE (
          UPPER(table_name) LIKE '%LOG%'
          OR UPPER(table_name) LIKE '%HIST%'
          OR UPPER(table_name) LIKE '%ARQUIVO%'
        )
        AND (
          UPPER(table_name) LIKE '%BANCO%'
          OR UPPER(table_name) LIKE '%REMESSA%'
          OR UPPER(table_name) LIKE '%RETORNO%'
          OR UPPER(table_name) LIKE '%COB%'
        )
      ORDER BY table_name
    `;

    const resultLog = await connection.execute(queryLogTables);

    if (resultLog.rows && resultLog.rows.length > 0) {
      console.log(`\nEncontradas ${resultLog.rows.length} tabelas de log:\n`);
      
      resultLog.rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(3)}. ${row[0]}`);
        console.log(`     Owner: ${row[1]} | Registros: ${row[2] || 'N/A'}`);
      });
    } else {
      console.log('❌ Nenhuma tabela de log específica encontrada.');
    }

    // =====================================================
    // 7. TRIGGERS RELACIONADAS A REMESSA/RETORNO
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('⚡ 7. TRIGGERS RELACIONADAS A OPERAÇÕES BANCÁRIAS');
    console.log('='.repeat(80));

    const queryTriggers = `
      SELECT 
        trigger_name,
        table_name,
        triggering_event,
        status
      FROM all_triggers
      WHERE (
          UPPER(trigger_name) LIKE '%REMESSA%'
          OR UPPER(trigger_name) LIKE '%RETORNO%'
          OR UPPER(trigger_name) LIKE '%BANCO%'
          OR UPPER(trigger_name) LIKE '%BAIXA%'
        )
      ORDER BY trigger_name
    `;

    const resultTriggers = await connection.execute(queryTriggers);

    if (resultTriggers.rows && resultTriggers.rows.length > 0) {
      console.log(`\nEncontradas ${resultTriggers.rows.length} triggers:\n`);
      
      resultTriggers.rows.forEach((row, index) => {
        console.log(`${String(index + 1).padStart(3)}. ${row[0]}`);
        console.log(`     Tabela: ${row[1]} | Evento: ${row[2]} | Status: ${row[3]}`);
      });
    } else {
      console.log('❌ Nenhuma trigger específica encontrada.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ CONSULTA FINALIZADA');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Erro ao consultar Oracle:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Conexão fechada');
      } catch (err) {
        console.error('❌ Erro ao fechar conexão:', err.message);
      }
    }
  }
}

consultarRemessaRetorno();

const oracledb = require('oracledb');
require('dotenv').config();

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

async function consultarProceduresRemessaRetorno() {
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

    console.log('✅ Conectado ao Oracle Database\n');

    // ═══════════════════════════════════════════════════════════════════════
    // 1. PROCEDURES DE REMESSA
    // ═══════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('📤 PROCEDURES/FUNCTIONS/PACKAGES DE REMESSA');
    console.log('═'.repeat(80));

    const queryRemessa = `
      SELECT 
        object_name,
        object_type,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
        AND (
          UPPER(object_name) LIKE '%REMESSA%'
          OR UPPER(object_name) LIKE '%REM_%'
          OR UPPER(object_name) LIKE '%_REM%'
          OR UPPER(object_name) LIKE '%CNAB%'
          OR UPPER(object_name) LIKE '%BOLETO%'
          OR UPPER(object_name) LIKE '%COBRANCA%'
          OR UPPER(object_name) LIKE '%GERAR_ARQ%'
          OR UPPER(object_name) LIKE '%ARQ_BANCO%'
        )
      ORDER BY object_type, object_name
    `;

    const resultRemessa = await connection.execute(queryRemessa);

    if (resultRemessa.rows && resultRemessa.rows.length > 0) {
      console.log(`\n✅ Encontrados ${resultRemessa.rows.length} objetos de REMESSA:\n`);
      resultRemessa.rows.forEach((row, index) => {
        console.log(`${index + 1}. 📦 ${row[1]}: ${row[0]}`);
        console.log(`   Status: ${row[2]}`);
        console.log(`   Criado: ${row[3]} | Modificado: ${row[4]}\n`);
      });
    } else {
      console.log('❌ Nenhuma procedure de remessa encontrada\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. PROCEDURES DE RETORNO
    // ═══════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('📥 PROCEDURES/FUNCTIONS/PACKAGES DE RETORNO');
    console.log('═'.repeat(80));

    const queryRetorno = `
      SELECT 
        object_name,
        object_type,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
        AND (
          UPPER(object_name) LIKE '%RETORNO%'
          OR UPPER(object_name) LIKE '%RET_%'
          OR UPPER(object_name) LIKE '%_RET%'
          OR UPPER(object_name) LIKE '%BAIXA%'
          OR UPPER(object_name) LIKE '%LIQUIDACAO%'
          OR UPPER(object_name) LIKE '%LIQUIDAR%'
          OR UPPER(object_name) LIKE '%IMPORTAR%'
          OR UPPER(object_name) LIKE '%IMP_ARQ%'
          OR UPPER(object_name) LIKE '%LER_ARQ%'
        )
      ORDER BY object_type, object_name
    `;

    const resultRetorno = await connection.execute(queryRetorno);

    if (resultRetorno.rows && resultRetorno.rows.length > 0) {
      console.log(`\n✅ Encontrados ${resultRetorno.rows.length} objetos de RETORNO:\n`);
      resultRetorno.rows.forEach((row, index) => {
        console.log(`${index + 1}. 📦 ${row[1]}: ${row[0]}`);
        console.log(`   Status: ${row[2]}`);
        console.log(`   Criado: ${row[3]} | Modificado: ${row[4]}\n`);
      });
    } else {
      console.log('❌ Nenhuma procedure de retorno encontrada\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. TABELAS RELACIONADAS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('🗃️ TABELAS RELACIONADAS');
    console.log('═'.repeat(80));

    const queryTabelas = `
      SELECT 
        table_name,
        num_rows,
        last_analyzed
      FROM all_tables
      WHERE (
          UPPER(table_name) LIKE '%REMESSA%'
          OR UPPER(table_name) LIKE '%RETORNO%'
          OR UPPER(table_name) LIKE '%CNAB%'
          OR UPPER(table_name) LIKE '%BOLETO%'
          OR UPPER(table_name) LIKE '%TITULO%'
          OR UPPER(table_name) LIKE '%COBRANCA%'
          OR UPPER(table_name) LIKE '%BAIXA%'
          OR UPPER(table_name) LIKE '%ARQ_BANCO%'
        )
      ORDER BY table_name
    `;

    const resultTabelas = await connection.execute(queryTabelas);

    if (resultTabelas.rows && resultTabelas.rows.length > 0) {
      console.log(`\n✅ Encontradas ${resultTabelas.rows.length} tabelas:\n`);
      resultTabelas.rows.forEach((row, index) => {
        console.log(`${index + 1}. 📋 ${row[0]}`);
        console.log(`   Registros: ${row[1] || 'N/A'} | Análise: ${row[2] || 'N/A'}\n`);
      });
    } else {
      console.log('❌ Nenhuma tabela relacionada encontrada\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CÓDIGO FONTE DAS PROCEDURES PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('📝 CÓDIGO FONTE DAS PROCEDURES (primeiras 5 de cada tipo)');
    console.log('═'.repeat(80));

    // Buscar código das procedures de REMESSA
    if (resultRemessa.rows && resultRemessa.rows.length > 0) {
      for (const row of resultRemessa.rows.slice(0, 5)) {
        const objectName = row[0];
        const objectType = row[1];

        try {
          const querySource = `
            SELECT text 
            FROM all_source 
            WHERE name = :objectName 
              AND type = :objectType
            ORDER BY line
          `;

          const sourceResult = await connection.execute(querySource, {
            objectName,
            objectType
          });

          if (sourceResult.rows && sourceResult.rows.length > 0) {
            console.log(`\n\n${'─'.repeat(60)}`);
            console.log(`📜 REMESSA - ${objectType}: ${objectName}`);
            console.log('─'.repeat(60));
            sourceResult.rows.forEach(srcRow => {
              process.stdout.write(srcRow[0]);
            });
            console.log('\n--- FIM ---');
          }
        } catch (err) {
          console.log(`⚠️ Não foi possível obter código de ${objectName}: ${err.message}`);
        }
      }
    }

    // Buscar código das procedures de RETORNO
    if (resultRetorno.rows && resultRetorno.rows.length > 0) {
      for (const row of resultRetorno.rows.slice(0, 5)) {
        const objectName = row[0];
        const objectType = row[1];

        try {
          const querySource = `
            SELECT text 
            FROM all_source 
            WHERE name = :objectName 
              AND type = :objectType
            ORDER BY line
          `;

          const sourceResult = await connection.execute(querySource, {
            objectName,
            objectType
          });

          if (sourceResult.rows && sourceResult.rows.length > 0) {
            console.log(`\n\n${'─'.repeat(60)}`);
            console.log(`📜 RETORNO - ${objectType}: ${objectName}`);
            console.log('─'.repeat(60));
            sourceResult.rows.forEach(srcRow => {
              process.stdout.write(srcRow[0]);
            });
            console.log('\n--- FIM ---');
          }
        } catch (err) {
          console.log(`⚠️ Não foi possível obter código de ${objectName}: ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. VIEWS RELACIONADAS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n\n' + '═'.repeat(80));
    console.log('👁️ VIEWS RELACIONADAS');
    console.log('═'.repeat(80));

    const queryViews = `
      SELECT view_name, text
      FROM all_views
      WHERE UPPER(view_name) LIKE '%REMESSA%'
         OR UPPER(view_name) LIKE '%RETORNO%'
         OR UPPER(view_name) LIKE '%CNAB%'
         OR UPPER(view_name) LIKE '%BOLETO%'
         OR UPPER(view_name) LIKE '%TITULO%'
      ORDER BY view_name
    `;

    const viewsResult = await connection.execute(queryViews);

    if (viewsResult.rows && viewsResult.rows.length > 0) {
      console.log(`\n✅ Encontradas ${viewsResult.rows.length} views:\n`);
      viewsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. 👁️ ${row[0]}`);
        const sqlPreview = row[1] ? row[1].substring(0, 200) : 'N/A';
        console.log(`   SQL: ${sqlPreview}...\n`);
      });
    } else {
      console.log('❌ Nenhuma view relacionada encontrada\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. ESTRUTURA DAS TABELAS PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('🔍 ESTRUTURA DAS TABELAS (primeiras 3)');
    console.log('═'.repeat(80));

    if (resultTabelas.rows && resultTabelas.rows.length > 0) {
      for (const tabela of resultTabelas.rows.slice(0, 3)) {
        const tableName = tabela[0];

        try {
          const queryColunas = `
            SELECT column_name, data_type, data_length, nullable
            FROM all_tab_columns
            WHERE table_name = :tableName
            ORDER BY column_id
          `;

          const colunasResult = await connection.execute(queryColunas, {
            tableName
          });

          if (colunasResult.rows && colunasResult.rows.length > 0) {
            console.log(`\n📋 Tabela: ${tableName}`);
            console.log('─'.repeat(50));
            colunasResult.rows.forEach(col => {
              const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
              console.log(`  ${col[0].padEnd(30)} ${col[1]}(${col[2]}) ${nullable}`);
            });
          }
        } catch (err) {
          console.log(`⚠️ Erro ao buscar colunas de ${tableName}: ${err.message}`);
        }
      }
    }

    console.log('\n\n' + '═'.repeat(80));
    console.log('✅ CONSULTA FINALIZADA COM SUCESSO');
    console.log('═'.repeat(80));

  } catch (err) {
    console.error('\n❌ Erro ao consultar Oracle:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n🔌 Conexão fechada');
      } catch (err) {
        console.error('❌ Erro ao fechar conexão:', err.message);
      }
    }
  }
}

consultarProceduresRemessaRetorno();

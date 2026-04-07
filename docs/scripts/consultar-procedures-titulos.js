const oracledb = require('oracledb');
require('dotenv').config();

// Adicionar Oracle Instant Client ao PATH antes de inicializar
const instantClientPath = 'C:\\oracle\\instantclient_23_8';
process.env.PATH = instantClientPath + ';' + process.env.PATH;

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

async function consultarProceduresTitulos() {
  let connection;

  try {
    const connectString = `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE}`;
    
    console.log(`🔌 Conectando ao Oracle: ${connectString}`);
    
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: connectString
    });

    console.log('✅ Conectado ao Oracle Database\n');

    // Lista das procedures/packages específicas de títulos e pagamentos
    const proceduresList = [
      'CARREGA_TITULOS',
      'CLIENTE_TITULO',
      'LIBERA_TITULOS',
      'RECEB_TOTAL_TITULO',
      'SAV_UPDATE_TITULOS',
      'TITULO_REM_NORMAL_AVISTA',
      'TITULOS_SERASA'
    ];

    console.log('📋 ANÁLISE DETALHADA DE PROCEDURES DE TÍTULOS E PAGAMENTOS\n');
    console.log('='.repeat(80));

    for (const procName of proceduresList) {
      console.log(`\n\n${'='.repeat(80)}`);
      console.log(`🔍 ANALISANDO: ${procName}`);
      console.log('='.repeat(80));

      // 1. Buscar informações básicas da procedure
      const queryInfo = `
        SELECT 
          object_name,
          object_type,
          status,
          created,
          last_ddl_time,
          owner
        FROM all_objects
        WHERE object_name = :procName
          AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      `;

      const resultInfo = await connection.execute(queryInfo, [procName]);

      if (resultInfo.rows && resultInfo.rows.length > 0) {
        resultInfo.rows.forEach((row) => {
          console.log(`\n📌 Informações:`);
          console.log(`   Nome: ${row[0]}`);
          console.log(`   Tipo: ${row[1]}`);
          console.log(`   Status: ${row[2]}`);
          console.log(`   Owner: ${row[5]}`);
          console.log(`   Criado: ${row[3]}`);
          console.log(`   Última modificação: ${row[4]}`);
        });

        // 2. Buscar o código fonte completo
        const querySource = `
          SELECT text
          FROM all_source
          WHERE name = :procName
          ORDER BY type, line
        `;

        const resultSource = await connection.execute(querySource, [procName]);

        if (resultSource.rows && resultSource.rows.length > 0) {
          console.log(`\n📄 CÓDIGO FONTE COMPLETO:\n`);
          console.log('-'.repeat(80));
          
          let sourceCode = '';
          resultSource.rows.forEach((row) => {
            sourceCode += row[0];
          });
          
          console.log(sourceCode);
          console.log('-'.repeat(80));
        }

        // 3. Se for um PACKAGE, buscar também os parâmetros de procedures dentro do package
        if (resultInfo.rows[0][1] === 'PACKAGE') {
          const queryProceduresInPackage = `
            SELECT 
              object_name,
              procedure_name,
              object_type
            FROM all_procedures
            WHERE object_name = :procName
              AND procedure_name IS NOT NULL
            ORDER BY procedure_name
          `;

          const resultProcs = await connection.execute(queryProceduresInPackage, [procName]);

          if (resultProcs.rows && resultProcs.rows.length > 0) {
            console.log(`\n📦 PROCEDURES DENTRO DO PACKAGE:\n`);
            resultProcs.rows.forEach((row, index) => {
              console.log(`   ${index + 1}. ${row[1]} (${row[2]})`);
            });

            // Buscar argumentos de cada procedure do package
            console.log(`\n📋 PARÂMETROS DAS PROCEDURES:\n`);
            
            for (const procRow of resultProcs.rows) {
              const procedureName = procRow[1];
              
              const queryArgs = `
                SELECT 
                  argument_name,
                  data_type,
                  in_out,
                  position,
                  data_length,
                  defaulted
                FROM all_arguments
                WHERE object_name = :procName
                  AND package_name = :packageName
                  AND argument_name IS NOT NULL
                ORDER BY position
              `;

              const resultArgs = await connection.execute(queryArgs, {
                procName: procedureName,
                packageName: procName
              });

              if (resultArgs.rows && resultArgs.rows.length > 0) {
                console.log(`\n   🔹 ${procedureName}:`);
                resultArgs.rows.forEach((arg) => {
                  console.log(`      • ${arg[0]} (${arg[1]}) - ${arg[2]} - Posição: ${arg[3]}${arg[5] === 'Y' ? ' [DEFAULT]' : ''}`);
                });
              }
            }
          }
        } else {
          // 4. Se for procedure/function simples, buscar parâmetros
          const queryArgs = `
            SELECT 
              argument_name,
              data_type,
              in_out,
              position,
              data_length,
              defaulted
            FROM all_arguments
            WHERE object_name = :procName
              AND argument_name IS NOT NULL
            ORDER BY position
          `;

          const resultArgs = await connection.execute(queryArgs, [procName]);

          if (resultArgs.rows && resultArgs.rows.length > 0) {
            console.log(`\n📋 PARÂMETROS:\n`);
            resultArgs.rows.forEach((arg) => {
              console.log(`   • ${arg[0]} (${arg[1]}) - ${arg[2]} - Posição: ${arg[3]}${arg[5] === 'Y' ? ' [DEFAULT]' : ''}`);
            });
          }
        }

        // 5. Buscar dependências
        const queryDeps = `
          SELECT 
            referenced_name,
            referenced_type,
            referenced_owner
          FROM all_dependencies
          WHERE name = :procName
            AND referenced_name NOT IN ('STANDARD', 'SYS', 'DBMS_STANDARD')
          ORDER BY referenced_name
        `;

        const resultDeps = await connection.execute(queryDeps, [procName]);

        if (resultDeps.rows && resultDeps.rows.length > 0) {
          console.log(`\n🔗 DEPENDÊNCIAS:\n`);
          resultDeps.rows.forEach((dep, index) => {
            console.log(`   ${index + 1}. ${dep[0]} (${dep[1]}) - Owner: ${dep[2]}`);
          });
        }

      } else {
        console.log(`\n⚠️  Procedure ${procName} não encontrada no banco de dados`);
      }
    }

    console.log(`\n\n${'='.repeat(80)}`);
    console.log('✅ ANÁLISE COMPLETA FINALIZADA');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Erro durante a consulta:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Conexão fechada');
      } catch (err) {
        console.error('❌ Erro ao fechar conexão:', err);
      }
    }
  }
}

consultarProceduresTitulos();

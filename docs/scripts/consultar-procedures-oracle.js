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

async function consultarProcedures() {
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

    // Consultar procedures relacionadas a contas a pagar
    const queryProcedures = `
      SELECT 
        object_name,
        object_type,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (
          UPPER(object_name) LIKE '%PGTO%'
          OR UPPER(object_name) LIKE '%PAGAR%'
          OR UPPER(object_name) LIKE '%TITULO%'
          OR UPPER(object_name) LIKE '%BOLETO%'
          OR UPPER(object_name) LIKE '%DUPLICATA%'
          OR UPPER(object_name) LIKE '%COBRANCA%'
          OR UPPER(object_name) LIKE '%CREDOR%'
        )
      ORDER BY object_name
    `;

    const result = await connection.execute(queryProcedures);

    console.log('\n📋 Procedures/Functions/Packages relacionadas a Contas a Pagar:\n');
    console.log('================================================');

    if (result.rows && result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Nome: ${row[0]}`);
        console.log(`   Tipo: ${row[1]}`);
        console.log(`   Status: ${row[2]}`);
        console.log(`   Criado em: ${row[3]}`);
        console.log(`   Última modificação: ${row[4]}`);
      });

      // Para cada procedure/function, tentar buscar o código fonte
      console.log('\n\n📄 Buscando código fonte das procedures...\n');
      console.log('================================================');

      for (const row of result.rows.slice(0, 5)) { // Primeiras 5 para não sobrecarregar
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
            console.log(`\n\n--- ${objectName} (${objectType}) ---`);
            sourceResult.rows.forEach(srcRow => {
              process.stdout.write(srcRow[0]);
            });
            console.log('\n--- FIM ---');
          }
        } catch (err) {
          console.log(`⚠️ Não foi possível obter código de ${objectName}: ${err.message}`);
        }
      }

    } else {
      console.log('❌ Nenhuma procedure/function encontrada com esses critérios.');
    }

    // Consultar também views relacionadas
    console.log('\n\n📊 Views relacionadas a Contas a Pagar:\n');
    console.log('================================================');

    const queryViews = `
      SELECT view_name, text
      FROM all_views
      WHERE UPPER(view_name) LIKE '%PGTO%'
         OR UPPER(view_name) LIKE '%PAGAR%'
         OR UPPER(view_name) LIKE '%TITULO%'
      ORDER BY view_name
    `;

    const viewsResult = await connection.execute(queryViews);

    if (viewsResult.rows && viewsResult.rows.length > 0) {
      viewsResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. View: ${row[0]}`);
        console.log(`   SQL: ${row[1].substring(0, 200)}...`);
      });
    } else {
      console.log('❌ Nenhuma view encontrada.');
    }

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

consultarProcedures();

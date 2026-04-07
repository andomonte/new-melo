import oracledb from 'oracledb';

// Configurar para modo thick (requer Oracle Instant Client instalado)
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err.message);
}

async function buscarProcedureConciliacao() {
  let connection;

  try {
    // Conectar ao banco Oracle
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log('✅ Conectado ao Oracle\n');

    // Buscar procedures que mencionam fin_cartao e conciliação
    console.log('=== BUSCANDO PROCEDURES DE CONCILIAÇÃO DE CARTÃO ===\n');
    
    const query = `
      SELECT 
        name,
        type,
        line,
        text
      FROM all_source
      WHERE owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE BODY')
        AND (
          UPPER(text) LIKE '%FIN_CARTAO%'
          OR UPPER(text) LIKE '%CAR_NRODOCUMENTO%'
          OR UPPER(text) LIKE '%CAR_NROAUTORIZACAO%'
        )
      ORDER BY name, line
    `;

    const result = await connection.execute(query);

    console.log(`Encontradas ${result.rows.length} linhas de código\n`);

    // Agrupar por procedure
    const procedures = {};
    for (const row of result.rows) {
      const [name, type, line, text] = row;
      if (!procedures[name]) {
        procedures[name] = {
          type: type,
          lines: []
        };
      }
      procedures[name].lines.push({ line, text });
    }

    // Mostrar procedures encontradas
    console.log('=== PROCEDURES ENCONTRADAS ===\n');
    for (const [name, data] of Object.entries(procedures)) {
      console.log(`\n📌 ${name} (${data.type})`);
      console.log(`   Total de linhas: ${data.lines.length}`);
      
      // Mostrar primeiras linhas para identificar
      console.log('   Primeiras linhas:');
      for (let i = 0; i < Math.min(5, data.lines.length); i++) {
        console.log(`   ${data.lines[i].line}: ${data.lines[i].text.trim()}`);
      }
    }

    // Buscar especificamente procedures que usam vTotParc ou vNsuDoc
    console.log('\n\n=== PROCEDURES COM LÓGICA DE PARCELAS ===\n');
    
    const queryParcelas = `
      SELECT DISTINCT name, type
      FROM all_source
      WHERE owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE BODY')
        AND (
          UPPER(text) LIKE '%VTOTPARC%'
          OR UPPER(text) LIKE '%VNSUDOC%'
          OR UPPER(text) LIKE '%CAR_NROPARCELA%'
        )
      ORDER BY name
    `;

    const resultParcelas = await connection.execute(queryParcelas);

    console.log(`Encontradas ${resultParcelas.rows.length} procedures com lógica de parcelas:\n`);
    for (const row of resultParcelas.rows) {
      const [name, type] = row;
      console.log(`  • ${name} (${type})`);
    }

    // Buscar código completo da procedure mais relevante
    if (resultParcelas.rows.length > 0) {
      const primeiraProcedure = resultParcelas.rows[0][0];
      console.log(`\n\n=== CÓDIGO COMPLETO: ${primeiraProcedure} ===\n`);

      const queryCompleto = `
        SELECT text
        FROM all_source
        WHERE owner = 'GERAL'
          AND name = :nome
        ORDER BY line
      `;

      const resultCompleto = await connection.execute(queryCompleto, [primeiraProcedure]);
      
      for (const row of resultCompleto.rows) {
        process.stdout.write(row[0]);
      }
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

buscarProcedureConciliacao();

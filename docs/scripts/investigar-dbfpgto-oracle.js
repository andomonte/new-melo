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
  console.log('✅ Oracle Instant Client inicializado em modo Thick\n');
} catch (err) {
  if (err.message.includes('already been initialized')) {
    console.log('✅ Oracle Instant Client já está em modo Thick\n');
  } else {
    console.error('❌ Erro ao inicializar Oracle Client:', err.message);
    process.exit(1);
  }
}

async function investigarDbfpgtoOracle() {
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
    console.log('═'.repeat(80));
    console.log('🔍 INVESTIGAÇÃO DA TABELA DBFPGTO NO ORACLE');
    console.log('═'.repeat(80));

    // 1. Verificar se a tabela DBFPGTO existe
    console.log('\n📋 1. VERIFICANDO EXISTÊNCIA DA TABELA DBFPGTO\n');
    
    const queryTabela = `
      SELECT 
        table_name,
        tablespace_name,
        status,
        num_rows,
        last_analyzed
      FROM all_tables
      WHERE UPPER(table_name) = 'DBFPGTO'
        AND owner = UPPER('${process.env.ORACLE_USER}')
      ORDER BY table_name
    `;

    const resultTabela = await connection.execute(queryTabela);

    if (resultTabela.rows.length === 0) {
      console.log('❌ Tabela DBFPGTO não encontrada no Oracle');
      
      // Buscar tabelas similares
      console.log('\n🔍 Procurando tabelas similares com "PGTO" no nome...\n');
      
      const querySimilar = `
        SELECT 
          table_name,
          tablespace_name,
          num_rows
        FROM all_tables
        WHERE UPPER(table_name) LIKE '%PGTO%'
          AND owner = UPPER('${process.env.ORACLE_USER}')
        ORDER BY table_name
      `;

      const resultSimilar = await connection.execute(querySimilar);

      if (resultSimilar.rows.length > 0) {
        console.log(`✅ Encontradas ${resultSimilar.rows.length} tabelas similares:\n`);
        resultSimilar.rows.forEach(row => {
          console.log(`   📊 ${row[0]} (${row[2] || 0} linhas)`);
        });
      } else {
        console.log('❌ Nenhuma tabela similar encontrada');
      }
    } else {
      console.log('✅ Tabela DBFPGTO encontrada!\n');
      resultTabela.rows.forEach(row => {
        console.log(`   Nome: ${row[0]}`);
        console.log(`   Tablespace: ${row[1]}`);
        console.log(`   Status: ${row[2]}`);
        console.log(`   Registros: ${row[3] || 'Não analisado'}`);
        console.log(`   Última análise: ${row[4] || 'Nunca'}`);
      });

      // 2. Estrutura da tabela DBFPGTO
      console.log('\n\n📊 2. ESTRUTURA DA TABELA DBFPGTO\n');

      const queryColunas = `
        SELECT 
          column_name,
          data_type,
          data_length,
          data_precision,
          data_scale,
          nullable,
          data_default
        FROM all_tab_columns
        WHERE table_name = 'DBFPGTO'
          AND owner = UPPER('${process.env.ORACLE_USER}')
        ORDER BY column_id
      `;

      const resultColunas = await connection.execute(queryColunas);

      console.log(`Total de colunas: ${resultColunas.rows.length}\n`);
      
      resultColunas.rows.forEach((row, index) => {
        const coluna = row[0];
        const tipo = row[1];
        const tamanho = row[2];
        const precisao = row[3];
        const escala = row[4];
        const nulo = row[5];
        
        let tipoCompleto = tipo;
        if (precisao) {
          tipoCompleto += `(${precisao}${escala ? ',' + escala : ''})`;
        } else if (tamanho && tipo !== 'NUMBER' && tipo !== 'DATE') {
          tipoCompleto += `(${tamanho})`;
        }
        
        const nullable = nulo === 'Y' ? 'NULL' : 'NOT NULL';
        
        console.log(`${index + 1}. ${coluna.padEnd(25)} ${tipoCompleto.padEnd(20)} ${nullable}`);
      });

      // 3. Chaves primárias e índices
      console.log('\n\n🔑 3. CHAVES PRIMÁRIAS E ÍNDICES\n');

      const queryConstraints = `
        SELECT 
          c.constraint_name,
          c.constraint_type,
          cc.column_name,
          cc.position
        FROM all_constraints c
        JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name 
          AND c.owner = cc.owner
        WHERE c.table_name = 'DBFPGTO'
          AND c.owner = UPPER('${process.env.ORACLE_USER}')
          AND c.constraint_type IN ('P', 'U')
        ORDER BY c.constraint_name, cc.position
      `;

      const resultConstraints = await connection.execute(queryConstraints);

      if (resultConstraints.rows.length > 0) {
        console.log('Chaves Primárias e Únicas:\n');
        let currentConstraint = '';
        resultConstraints.rows.forEach(row => {
          if (row[0] !== currentConstraint) {
            currentConstraint = row[0];
            const tipo = row[1] === 'P' ? 'PRIMARY KEY' : 'UNIQUE';
            console.log(`   ${tipo}: ${row[0]}`);
          }
          console.log(`      - ${row[2]}`);
        });
      } else {
        console.log('❌ Nenhuma chave primária ou única encontrada');
      }

      // 4. Registros de exemplo
      console.log('\n\n📝 4. EXEMPLOS DE REGISTROS (primeiros 3)\n');

      const querySample = `
        SELECT * FROM DBFPGTO
        WHERE ROWNUM <= 3
      `;

      const resultSample = await connection.execute(querySample);

      if (resultSample.rows.length > 0) {
        console.log(`Encontrados ${resultSample.rows.length} registros:\n`);
        resultSample.rows.forEach((row, index) => {
          console.log(`Registro ${index + 1}:`);
          resultSample.metaData.forEach((meta, colIndex) => {
            console.log(`   ${meta.name}: ${row[colIndex]}`);
          });
          console.log('');
        });
      } else {
        console.log('⚠️  Tabela vazia - sem registros');
      }
    }

    // 5. Buscar PROCEDURES que operam em DBFPGTO
    console.log('\n\n🔧 5. PROCEDURES QUE OPERAM EM DBFPGTO\n');

    const queryProcedures = `
      SELECT DISTINCT
        name,
        type,
        line,
        text
      FROM all_source
      WHERE owner = UPPER('${process.env.ORACLE_USER}')
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
        AND UPPER(text) LIKE '%DBFPGTO%'
      ORDER BY name, type, line
    `;

    const resultProcedures = await connection.execute(queryProcedures);

    if (resultProcedures.rows.length > 0) {
      // Agrupar por nome e tipo
      const proceduresMap = new Map();
      
      resultProcedures.rows.forEach(row => {
        const key = `${row[0]}_${row[1]}`;
        if (!proceduresMap.has(key)) {
          proceduresMap.set(key, {
            name: row[0],
            type: row[1],
            lines: []
          });
        }
        proceduresMap.get(key).lines.push({
          line: row[2],
          text: row[3]
        });
      });

      console.log(`✅ Encontradas ${proceduresMap.size} procedures/funções que referenciam DBFPGTO:\n`);

      proceduresMap.forEach((proc, key) => {
        console.log(`📦 ${proc.type}: ${proc.name}`);
        console.log(`   Linhas com referência: ${proc.lines.length}`);
        console.log(`   Primeiras referências:`);
        
        proc.lines.slice(0, 3).forEach(item => {
          console.log(`      Linha ${item.line}: ${item.text.trim().substring(0, 80)}`);
        });
        console.log('');
      });

      // 6. Buscar procedures específicas de títulos/pagamentos
      console.log('\n\n📋 6. PROCEDURES DE TÍTULOS QUE PODEM USAR DBFPGTO\n');

      const proceduresTitulos = [
        'CARREGA_TITULOS',
        'CLIENTE_TITULO',
        'LIBERA_TITULOS',
        'RECEB_TOTAL_TITULO',
        'SAV_UPDATE_TITULOS',
        'TITULO_REM_NORMAL_AVISTA',
        'TITULOS_SERASA',
        'GERA_PGTO',
        'INSERE_PGTO',
        'ATUALIZA_PGTO'
      ];

      for (const procName of proceduresTitulos) {
        const queryProc = `
          SELECT 
            object_name,
            object_type,
            status,
            created,
            last_ddl_time
          FROM all_objects
          WHERE object_name = '${procName}'
            AND owner = UPPER('${process.env.ORACLE_USER}')
            AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        `;

        const resultProc = await connection.execute(queryProc);

        if (resultProc.rows.length > 0) {
          const proc = resultProc.rows[0];
          console.log(`✅ ${proc[1]}: ${proc[0]}`);
          console.log(`   Status: ${proc[2]}`);
          console.log(`   Criado: ${proc[3]}`);
          console.log(`   Última modificação: ${proc[4]}`);

          // Verificar se usa DBFPGTO
          const queryUsaDbfpgto = `
            SELECT COUNT(*) as qtd
            FROM all_source
            WHERE name = '${procName}'
              AND owner = UPPER('${process.env.ORACLE_USER}')
              AND UPPER(text) LIKE '%DBFPGTO%'
          `;

          const resultUsa = await connection.execute(queryUsaDbfpgto);
          const qtdRefs = resultUsa.rows[0][0];

          if (qtdRefs > 0) {
            console.log(`   🎯 REFERENCIA DBFPGTO: ${qtdRefs} vez(es)`);
          } else {
            console.log(`   ⚠️  Não referencia DBFPGTO diretamente`);
          }
          console.log('');
        }
      }

    } else {
      console.log('❌ Nenhuma procedure encontrada que referencie DBFPGTO');
    }

    // 7. Buscar triggers
    console.log('\n\n⚡ 7. TRIGGERS NA TABELA DBFPGTO\n');

    const queryTriggers = `
      SELECT 
        trigger_name,
        trigger_type,
        triggering_event,
        status,
        description
      FROM all_triggers
      WHERE table_name = 'DBFPGTO'
        AND owner = UPPER('${process.env.ORACLE_USER}')
      ORDER BY trigger_name
    `;

    const resultTriggers = await connection.execute(queryTriggers);

    if (resultTriggers.rows.length > 0) {
      console.log(`✅ Encontrados ${resultTriggers.rows.length} trigger(s):\n`);
      resultTriggers.rows.forEach((row, index) => {
        console.log(`Trigger ${index + 1}: ${row[0]}`);
        console.log(`   Tipo: ${row[1]}`);
        console.log(`   Evento: ${row[2]}`);
        console.log(`   Status: ${row[3]}`);
        console.log(`   Descrição: ${row[4]}`);
        console.log('');
      });
    } else {
      console.log('❌ Nenhum trigger encontrado');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ INVESTIGAÇÃO CONCLUÍDA');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔌 Conexão Oracle fechada');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err.message);
      }
    }
  }
}

investigarDbfpgtoOracle();

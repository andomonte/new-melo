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

async function analisarRemessaRetornoDetalhado() {
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

    // =====================================================
    // PARTE 1: ESTRUTURA DAS TABELAS DBREMESSA_* E DBRETORNO_*
    // =====================================================
    console.log('\n' + '='.repeat(100));
    console.log('📊 PARTE 1: ESTRUTURA DAS TABELAS DE REMESSA E RETORNO');
    console.log('='.repeat(100));

    const tabelasParaAnalisar = [
      'DBREMESSA_ARQUIVO',
      'DBREMESSA_DETALHE',
      'DBRETORNO_ARQUIVO',
      'DBRETORNO_DETALHE',
      'DBRETORNO_OCORRENCIAS',
      'DBRETORNO_SITUACAO'
    ];

    for (const tabela of tabelasParaAnalisar) {
      console.log(`\n\n📋 Estrutura de ${tabela}:`);
      console.log('-'.repeat(90));

      const queryEstrutura = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          DATA_LENGTH,
          DATA_PRECISION,
          DATA_SCALE,
          NULLABLE,
          DATA_DEFAULT
        FROM all_tab_columns
        WHERE UPPER(table_name) = '${tabela}'
        ORDER BY column_id
      `;

      const result = await connection.execute(queryEstrutura);

      if (result.rows && result.rows.length > 0) {
        console.log('COLUNA                    | TIPO              | TAMANHO  | PREC | ESCALA | NULL | DEFAULT');
        console.log('--------------------------|-------------------|----------|------|--------|------|--------');
        
        result.rows.forEach(row => {
          const col = (row[0] || '').padEnd(25);
          const tipo = (row[1] || '').padEnd(17);
          const tam = String(row[2] || '').padEnd(8);
          const prec = String(row[3] || '').padEnd(4);
          const escala = String(row[4] || '').padEnd(6);
          const nullable = (row[5] || '').padEnd(4);
          const def = (row[6] || '').toString().substring(0, 20);
          console.log(`${col} | ${tipo} | ${tam} | ${prec} | ${escala} | ${nullable} | ${def}`);
        });

        // Buscar sample de dados
        console.log(`\n📌 Sample de dados (5 registros):`);
        try {
          const querySample = `SELECT * FROM ${tabela} WHERE ROWNUM <= 5`;
          const sampleResult = await connection.execute(querySample, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          
          if (sampleResult.rows && sampleResult.rows.length > 0) {
            sampleResult.rows.forEach((row, idx) => {
              console.log(`\n  Registro ${idx + 1}:`);
              Object.keys(row).forEach(key => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                  console.log(`    ${key}: ${value}`);
                }
              });
            });
          }
        } catch (err) {
          console.log(`  ⚠️ Erro ao buscar sample: ${err.message}`);
        }
      } else {
        console.log(`  ⚠️ Tabela não encontrada ou sem colunas.`);
      }
    }

    // =====================================================
    // PARTE 2: CÓDIGO FONTE DOS PACKAGES REMESSABANCO E RETORNO
    // =====================================================
    console.log('\n\n' + '='.repeat(100));
    console.log('📦 PARTE 2: CÓDIGO FONTE DOS PACKAGES REMESSABANCO E RETORNO');
    console.log('='.repeat(100));

    const packagesParaBuscar = [
      { name: 'REMESSABANCO', type: 'PACKAGE' },
      { name: 'REMESSABANCO', type: 'PACKAGE BODY' },
      { name: 'RETORNO', type: 'PACKAGE' },
      { name: 'RETORNO', type: 'PACKAGE BODY' }
    ];

    for (const pkg of packagesParaBuscar) {
      console.log(`\n\n${'#'.repeat(80)}`);
      console.log(`# ${pkg.name} - ${pkg.type}`);
      console.log(`${'#'.repeat(80)}\n`);

      const querySource = `
        SELECT line, text 
        FROM all_source 
        WHERE name = :pkgName
          AND type = :pkgType
          AND owner = 'GERAL'
        ORDER BY line
      `;

      try {
        const sourceResult = await connection.execute(querySource, {
          pkgName: pkg.name,
          pkgType: pkg.type
        });

        if (sourceResult.rows && sourceResult.rows.length > 0) {
          console.log(`Total de linhas: ${sourceResult.rows.length}\n`);
          
          sourceResult.rows.forEach(row => {
            const lineNum = String(row[0]).padStart(5);
            process.stdout.write(`${lineNum}: ${row[1]}`);
          });
        } else {
          console.log('  ⚠️ Código fonte não encontrado.');
        }
      } catch (err) {
        console.log(`  ⚠️ Erro ao buscar código: ${err.message}`);
      }
    }

    // =====================================================
    // PARTE 3: TRIGGERS DE INSERT E SEU CÓDIGO
    // =====================================================
    console.log('\n\n' + '='.repeat(100));
    console.log('⚡ PARTE 3: TRIGGERS DE REMESSA/RETORNO - CÓDIGO FONTE');
    console.log('='.repeat(100));

    const triggersParaBuscar = [
      'TRG_BI_DBREMESSA_ARQUIVO',
      'TRG_BI_DBREMESSA_DETALHE',
      'TRG_BI_DBRETORNO_ARQUIVO',
      'TRG_BI_DBRETORNO_DETALHE',
      'TRG_BI_DBRETORNO_SITUACAO'
    ];

    for (const triggerName of triggersParaBuscar) {
      console.log(`\n\n${'*'.repeat(60)}`);
      console.log(`* TRIGGER: ${triggerName}`);
      console.log(`${'*'.repeat(60)}`);

      // Buscar informações da trigger
      const queryTriggerInfo = `
        SELECT 
          trigger_name,
          table_name,
          triggering_event,
          trigger_type,
          status,
          action_type
        FROM all_triggers
        WHERE trigger_name = :triggerName
          AND owner = 'GERAL'
      `;

      try {
        const infoResult = await connection.execute(queryTriggerInfo, { triggerName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (infoResult.rows && infoResult.rows.length > 0) {
          const info = infoResult.rows[0];
          console.log(`\nTabela: ${info.TABLE_NAME}`);
          console.log(`Evento: ${info.TRIGGERING_EVENT}`);
          console.log(`Tipo: ${info.TRIGGER_TYPE}`);
          console.log(`Status: ${info.STATUS}`);
          console.log(`Action: ${info.ACTION_TYPE}`);
        }

        // Buscar código fonte da trigger
        const queryTriggerSource = `
          SELECT line, text 
          FROM all_source 
          WHERE name = :triggerName
            AND type = 'TRIGGER'
            AND owner = 'GERAL'
          ORDER BY line
        `;

        const sourceResult = await connection.execute(queryTriggerSource, { triggerName });

        if (sourceResult.rows && sourceResult.rows.length > 0) {
          console.log(`\nCódigo fonte (${sourceResult.rows.length} linhas):\n`);
          
          sourceResult.rows.forEach(row => {
            const lineNum = String(row[0]).padStart(4);
            process.stdout.write(`${lineNum}: ${row[1]}`);
          });
        } else {
          console.log('\n  ⚠️ Código fonte não encontrado na all_source.');
          
          // Tentar buscar o trigger_body
          const queryTriggerBody = `
            SELECT trigger_body
            FROM all_triggers
            WHERE trigger_name = :triggerName
              AND owner = 'GERAL'
          `;
          
          const bodyResult = await connection.execute(queryTriggerBody, { triggerName });
          
          if (bodyResult.rows && bodyResult.rows.length > 0 && bodyResult.rows[0][0]) {
            console.log('\nTrigger Body:');
            console.log(bodyResult.rows[0][0]);
          }
        }
      } catch (err) {
        console.log(`  ⚠️ Erro: ${err.message}`);
      }
    }

    // =====================================================
    // BÔNUS: FLUXO RESUMIDO
    // =====================================================
    console.log('\n\n' + '='.repeat(100));
    console.log('📝 RESUMO DO FLUXO DE REMESSA E RETORNO');
    console.log('='.repeat(100));
    
    console.log(`
FLUXO DE REMESSA:
================
1. Títulos são selecionados da tabela DBRECEB (contas a receber)
2. O package REMESSABANCO gera o arquivo CNAB (240 ou 400)
3. Registro é inserido em DBREMESSA_ARQUIVO (trigger TRG_BI_DBREMESSA_ARQUIVO gera ID)
4. Cada título incluído gera um registro em DBREMESSA_DETALHE (trigger TRG_BI_DBREMESSA_DETALHE gera ID)
5. O campo NRO_BANCO em DBRECEB é preenchido com o nosso número

FLUXO DE RETORNO:
================
1. Arquivo de retorno é lido pelo package RETORNO
2. Registro é inserido em DBRETORNO_ARQUIVO (trigger TRG_BI_DBRETORNO_ARQUIVO gera ID)
3. Cada linha do retorno gera um registro em DBRETORNO_DETALHE (trigger TRG_BI_DBRETORNO_DETALHE gera ID)
4. O código de ocorrência é mapeado através de DBRETORNO_OCORRENCIAS
5. O título em DBRECEB é atualizado (baixa, protesto, etc)
`);

    console.log('\n' + '='.repeat(100));
    console.log('✅ ANÁLISE DETALHADA FINALIZADA');
    console.log('='.repeat(100));

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

analisarRemessaRetornoDetalhado();

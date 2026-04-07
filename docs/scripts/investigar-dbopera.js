/**
 * Script para investigar a tabela DBOPERA (Operadoras de Cartão)
 * 
 * Objetivo: Entender estrutura e como é usado para importação
 */

const oracledb = require('oracledb');

async function investigarDbopera() {
  let connection;

  try {
    // Tentar usar o Thick mode (Oracle Instant Client)
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
    }

    // Configuração da conexão
    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    console.log('Conectando ao Oracle...');
    connection = await oracledb.getConnection(config);
    console.log('✅ Conectado com sucesso!\n');
    console.log('═'.repeat(80));

    // 1. Estrutura da tabela DBOPERA
    console.log('\n📋 ESTRUTURA DA TABELA DBOPERA:\n');
    
    const queryEstrutura = `
      SELECT column_name, data_type, data_length, nullable, data_default
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBOPERA'
      ORDER BY column_id
    `;

    const estrutura = await connection.execute(queryEstrutura);

    if (estrutura.rows.length > 0) {
      estrutura.rows.forEach(col => {
        const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
        const defaultVal = col[4] ? ` DEFAULT ${col[4]}` : '';
        console.log(`   ${col[0].padEnd(30)} ${col[1]}(${col[2]}) ${nullable}${defaultVal}`);
      });
    } else {
      console.log('   Tabela DBOPERA não encontrada');
    }

    // 2. Contar registros e ver exemplos
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 DADOS NA TABELA DBOPERA:\n');

    const queryCount = `SELECT COUNT(*) as total FROM GERAL.DBOPERA`;
    const countResult = await connection.execute(queryCount);
    console.log(`Total de registros: ${countResult.rows[0][0]}\n`);

    // 3. Ver todos os registros (amostra)
    const queryDados = `
      SELECT * FROM GERAL.DBOPERA
      ORDER BY CODOPERA
    `;

    const dados = await connection.execute(queryDados);

    if (dados.rows.length > 0) {
      console.log('Operadoras cadastradas:');
      console.log('─'.repeat(80));
      
      dados.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Operadora:`);
        dados.metaData.forEach((meta, colIndex) => {
          const value = row[colIndex];
          if (value !== null && value !== undefined) {
            console.log(`   ${meta.name.padEnd(25)}: ${value}`);
          }
        });
      });
    }

    // 4. Buscar tabelas relacionadas a DBOPERA
    console.log('\n\n═'.repeat(80));
    console.log('\n🔗 TABELAS RELACIONADAS (Foreign Keys):\n');

    const queryRelacionadas = `
      SELECT 
        a.table_name,
        a.column_name,
        a.constraint_name
      FROM all_cons_columns a
      JOIN all_constraints c ON a.owner = c.owner 
        AND a.constraint_name = c.constraint_name
      WHERE c.constraint_type = 'R'
        AND a.owner = 'GERAL'
        AND c.r_constraint_name IN (
          SELECT constraint_name 
          FROM all_constraints 
          WHERE owner = 'GERAL' 
            AND table_name = 'DBOPERA'
        )
      ORDER BY a.table_name
    `;

    const relacionadas = await connection.execute(queryRelacionadas);

    if (relacionadas.rows.length > 0) {
      relacionadas.rows.forEach(row => {
        console.log(`   ${row[0]} (${row[1]}) - FK: ${row[2]}`);
      });
    } else {
      console.log('   Nenhuma FK encontrada ou tabela não tem PKs referenciadas');
    }

    // 5. Buscar procedures que usam DBOPERA
    console.log('\n\n═'.repeat(80));
    console.log('\n🔧 PROCEDURES QUE USAM DBOPERA:\n');

    const queryProcs = `
      SELECT DISTINCT 
        name,
        type,
        line,
        text
      FROM all_source
      WHERE owner = 'GERAL'
        AND UPPER(text) LIKE '%DBOPERA%'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      ORDER BY name, type, line
    `;

    const procs = await connection.execute(queryProcs);

    if (procs.rows.length > 0) {
      let currentProc = '';
      let lineCount = 0;
      
      procs.rows.forEach(row => {
        const procName = row[0];
        if (procName !== currentProc) {
          if (lineCount > 0) {
            console.log(`   (${lineCount} referências)\n`);
          }
          currentProc = procName;
          lineCount = 0;
          console.log(`📌 ${row[1]}: ${procName}`);
        }
        lineCount++;
        
        // Mostrar apenas primeiras 3 linhas de cada proc
        if (lineCount <= 3) {
          const texto = row[3].trim();
          if (texto.length > 0) {
            console.log(`   L${row[2]}: ${texto.substring(0, 80)}`);
          }
        }
      });
      
      if (lineCount > 0) {
        console.log(`   (${lineCount} referências)\n`);
      }
    } else {
      console.log('   Nenhuma procedure encontrada usando DBOPERA');
    }

    // 6. Ver se tem tabela de importação relacionada
    console.log('\n\n═'.repeat(80));
    console.log('\n📁 TABELAS DE IMPORTAÇÃO RELACIONADAS:\n');

    const queryImport = `
      SELECT table_name, num_rows
      FROM all_tables
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%IMPORT%'
         OR UPPER(table_name) LIKE '%ARQUIVO%'
         OR UPPER(table_name) LIKE '%CARTAO%'
         OR UPPER(table_name) LIKE '%OPERA%')
      ORDER BY table_name
    `;

    const importTables = await connection.execute(queryImport);

    if (importTables.rows.length > 0) {
      importTables.rows.forEach(row => {
        console.log(`   ${row[0].padEnd(40)} (${row[1] || 0} registros)`);
      });
    }

    console.log('\n\n═'.repeat(80));
    console.log('\n✅ Investigação concluída!\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔌 Conexão fechada.\n');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err.message);
      }
    }
  }
}

// Executar
investigarDbopera();

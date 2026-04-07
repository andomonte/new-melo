/**
 * Script para analisar procedures e estrutura de Contas a Receber no Oracle
 * Analisa como é feita a listagem e quais campos são utilizados
 */

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

async function analisarContasReceber() {
  let connection;

  try {
    console.log('===================================================================');
    console.log('ANÁLISE DE CONTAS A RECEBER - ORACLE');
    console.log('===================================================================\n');

    // Configuração da conexão Oracle usando as variáveis de ambiente
    const connectString = `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE}`;
    
    console.log(`🔌 Conectando ao Oracle: ${connectString}`);
    
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: connectString
    });

    console.log('✅ Conectado ao Oracle Database\n');

    // 1. Buscar procedures relacionadas a Contas a Receber
    console.log('1. PROCEDURES RELACIONADAS A CONTAS A RECEBER');
    console.log('-------------------------------------------------------------------');
    
    const proceduresQuery = `
      SELECT 
        object_name,
        object_type,
        status,
        created,
        last_ddl_time
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (
          UPPER(object_name) LIKE '%RECEB%' 
          OR UPPER(object_name) LIKE '%CONTAS%R%'
          OR UPPER(object_name) LIKE '%TITULO%'
          OR UPPER(object_name) LIKE '%DUPLICATA%'
        )
      ORDER BY object_type, object_name
    `;

    const procedures = await connection.execute(proceduresQuery);
    
    if (procedures.rows.length > 0) {
      console.log(`\nEncontradas ${procedures.rows.length} procedures/functions relacionadas:\n`);
      procedures.rows.forEach(row => {
        console.log(`  • ${row[1]}: ${row[0]}`);
        console.log(`    Status: ${row[2]} | Criado: ${row[3]?.toISOString().split('T')[0]} | Modificado: ${row[4]?.toISOString().split('T')[0]}`);
      });
    } else {
      console.log('Nenhuma procedure encontrada com os critérios de busca.');
    }

    // 2. Analisar estrutura da tabela DBRECEB (principal de contas a receber)
    console.log('\n\n2. ESTRUTURA DA TABELA DBRECEB (Contas a Receber)');
    console.log('-------------------------------------------------------------------');
    
    const tableStructureQuery = `
      SELECT 
        column_name,
        data_type,
        data_length,
        nullable,
        data_default
      FROM all_tab_columns
      WHERE table_name = 'DBRECEB'
      ORDER BY column_id
    `;

    const tableStructure = await connection.execute(tableStructureQuery);
    
    if (tableStructure.rows.length > 0) {
      console.log(`\nColunas da tabela DBRECEB (${tableStructure.rows.length} campos):\n`);
      tableStructure.rows.forEach(row => {
        const nullable = row[3] === 'Y' ? 'NULL' : 'NOT NULL';
        const defaultVal = row[4] ? ` | Default: ${row[4]}` : '';
        console.log(`  • ${row[0].padEnd(30)} ${row[1]}(${row[2]}) ${nullable}${defaultVal}`);
      });
    }

    // 3. Buscar views relacionadas
    console.log('\n\n3. VIEWS RELACIONADAS A CONTAS A RECEBER');
    console.log('-------------------------------------------------------------------');
    
    const viewsQuery = `
      SELECT 
        view_name,
        text_length
      FROM all_views
      WHERE (
          UPPER(view_name) LIKE '%RECEB%' 
          OR UPPER(view_name) LIKE '%TITULO%'
          OR UPPER(view_name) LIKE '%DUPLICATA%'
        )
      ORDER BY view_name
    `;

    const views = await connection.execute(viewsQuery);
    
    if (views.rows.length > 0) {
      console.log(`\nEncontradas ${views.rows.length} views:\n`);
      views.rows.forEach(row => {
        console.log(`  • ${row[0]} (${row[1]} caracteres)`);
      });

      // Para cada view, buscar a definição
      for (const view of views.rows.slice(0, 3)) { // Limitar a 3 views para não ficar muito extenso
        console.log(`\n  Definição da VIEW ${view[0]}:`);
        console.log('  ' + '─'.repeat(70));
        
        const viewDefQuery = `
          SELECT text
          FROM all_views
          WHERE view_name = :viewName
        `;
        
        const viewDef = await connection.execute(viewDefQuery, { viewName: view[0] });
        if (viewDef.rows.length > 0) {
          const text = viewDef.rows[0][0];
          // Formatar o SQL para melhor legibilidade
          const formattedSql = text
            .replace(/SELECT/gi, '\n  SELECT')
            .replace(/FROM/gi, '\n  FROM')
            .replace(/WHERE/gi, '\n  WHERE')
            .replace(/AND/gi, '\n    AND')
            .replace(/ORDER BY/gi, '\n  ORDER BY');
          console.log(formattedSql);
        }
      }
    }

    // 4. Buscar índices da tabela DBRECEB
    console.log('\n\n4. ÍNDICES DA TABELA DBRECEB');
    console.log('-------------------------------------------------------------------');
    
    const indexesQuery = `
      SELECT 
        i.index_name,
        i.uniqueness,
        LISTAGG(ic.column_name, ', ') WITHIN GROUP (ORDER BY ic.column_position) as columns
      FROM all_indexes i
      JOIN all_ind_columns ic ON i.index_name = ic.index_name
      WHERE i.table_name = 'DBRECEB'
      GROUP BY i.index_name, i.uniqueness
      ORDER BY i.index_name
    `;

    const indexes = await connection.execute(indexesQuery);
    
    if (indexes.rows.length > 0) {
      console.log(`\nÍndices encontrados (${indexes.rows.length}):\n`);
      indexes.rows.forEach(row => {
        console.log(`  • ${row[0]} (${row[1]})`);
        console.log(`    Colunas: ${row[2]}`);
      });
    }

    // 5. Buscar tabelas relacionadas (foreign keys)
    console.log('\n\n5. RELACIONAMENTOS (Foreign Keys da DBRECEB)');
    console.log('-------------------------------------------------------------------');
    
    const fkQuery = `
      SELECT 
        c.constraint_name,
        c.table_name as from_table,
        cc.column_name as from_column,
        r.table_name as to_table,
        rc.column_name as to_column
      FROM all_constraints c
      JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name
      JOIN all_constraints r ON c.r_constraint_name = r.constraint_name
      JOIN all_cons_columns rc ON r.constraint_name = rc.constraint_name
      WHERE c.constraint_type = 'R'
        AND c.table_name = 'DBRECEB'
      ORDER BY c.constraint_name
    `;

    const foreignKeys = await connection.execute(fkQuery);
    
    if (foreignKeys.rows.length > 0) {
      console.log(`\nRelacionamentos encontrados (${foreignKeys.rows.length}):\n`);
      foreignKeys.rows.forEach(row => {
        console.log(`  • ${row[0]}`);
        console.log(`    ${row[1]}.${row[2]} → ${row[3]}.${row[4]}`);
      });
    }

    // 6. Buscar código fonte de procedures principais
    console.log('\n\n6. CÓDIGO FONTE DAS PROCEDURES PRINCIPAIS');
    console.log('-------------------------------------------------------------------');
    
    // Buscar procedures que fazem SELECT na DBRECEB
    const procSourceQuery = `
      SELECT DISTINCT name, type
      FROM all_source
      WHERE (
          UPPER(text) LIKE '%SELECT%FROM%DBRECEB%'
          OR UPPER(text) LIKE '%DBRECEB%WHERE%'
        )
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE BODY')
      ORDER BY type, name
    `;

    const procSources = await connection.execute(procSourceQuery);
    
    if (procSources.rows.length > 0) {
      console.log(`\nProcedures que consultam DBRECEB (${procSources.rows.length}):\n`);
      
      for (const proc of procSources.rows.slice(0, 5)) { // Limitar a 5 procedures
        console.log(`\n  ${proc[1]}: ${proc[0]}`);
        console.log('  ' + '─'.repeat(70));
        
        const sourceQuery = `
          SELECT text
          FROM all_source
          WHERE name = :procName
            AND type = :procType
          ORDER BY line
        `;
        
        const source = await connection.execute(sourceQuery, {
          procName: proc[0],
          procType: proc[1]
        });
        
        if (source.rows.length > 0) {
          // Concatenar todas as linhas
          const fullSource = source.rows.map(r => r[0]).join('');
          
          // Extrair apenas as partes relevantes (SELECTs)
          const selectMatches = fullSource.match(/SELECT[\s\S]*?FROM[\s\S]*?DBRECEB[\s\S]*?(?=;|WHERE|ORDER BY|GROUP BY|\))/gi);
          
          if (selectMatches) {
            selectMatches.slice(0, 2).forEach((match, idx) => {
              console.log(`\n  Query ${idx + 1}:`);
              const formatted = match
                .replace(/SELECT/gi, '\n    SELECT')
                .replace(/FROM/gi, '\n    FROM')
                .replace(/WHERE/gi, '\n    WHERE')
                .replace(/AND/gi, '\n      AND')
                .replace(/OR/gi, '\n      OR')
                .replace(/ORDER BY/gi, '\n    ORDER BY')
                .replace(/GROUP BY/gi, '\n    GROUP BY');
              console.log(formatted.substring(0, 500) + (formatted.length > 500 ? '...' : ''));
            });
          }
        }
      }
    }

    // 7. Analisar dados de exemplo
    console.log('\n\n7. EXEMPLO DE DADOS DA TABELA DBRECEB');
    console.log('-------------------------------------------------------------------');
    
    const sampleDataQuery = `
      SELECT *
      FROM (
        SELECT * FROM DBRECEB
        ORDER BY DBMS_RANDOM.VALUE
      )
      WHERE ROWNUM <= 3
    `;

    try {
      const sampleData = await connection.execute(sampleDataQuery);
      
      if (sampleData.rows.length > 0) {
        console.log(`\nRegistros de exemplo (${sampleData.rows.length}):\n`);
        
        // Mostrar nome das colunas
        console.log('Colunas:', sampleData.metaData.map(col => col.name).join(', '));
        
        // Mostrar dados
        sampleData.rows.forEach((row, idx) => {
          console.log(`\n  Registro ${idx + 1}:`);
          sampleData.metaData.forEach((col, colIdx) => {
            const value = row[colIdx];
            if (value !== null && value !== undefined) {
              console.log(`    ${col.name}: ${value}`);
            }
          });
        });
      }
    } catch (err) {
      console.log('Não foi possível buscar dados de exemplo:', err.message);
    }

    console.log('\n\n===================================================================');
    console.log('ANÁLISE CONCLUÍDA COM SUCESSO');
    console.log('===================================================================\n');

  } catch (err) {
    console.error('❌ Erro na análise:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Conexão Oracle fechada\n');
      } catch (err) {
        console.error('❌ Erro ao fechar conexão:', err.message);
      }
    }
  }
}

// Executar análise
analisarContasReceber();

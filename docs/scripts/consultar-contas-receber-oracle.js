/**
 * Script para investigar tabelas e procedures de Contas a Receber no Oracle
 * 
 * Objetivo: Mapear estrutura de títulos/duplicatas/contas a receber
 */

const oracledb = require('oracledb');

async function investigarContasReceber() {
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

    // 1. Buscar tabelas relacionadas a contas a receber
    console.log('\n📊 TABELAS RELACIONADAS A CONTAS/TÍTULOS A RECEBER:\n');
    
    const queryTabelas = `
      SELECT table_name, num_rows
      FROM all_tables 
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%RECEB%' 
         OR UPPER(table_name) LIKE '%TITULO%' 
         OR UPPER(table_name) LIKE '%DUPLICATA%'
         OR UPPER(table_name) LIKE '%CONTA%'
         OR UPPER(table_name) LIKE '%FATURA%'
         OR UPPER(table_name) LIKE '%PARCELA%')
      ORDER BY table_name
    `;

    const tabelasResult = await connection.execute(queryTabelas);

    if (tabelasResult.rows.length > 0) {
      tabelasResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0].padEnd(40)} (${row[1] || 0} registros)`);
      });
    } else {
      console.log('Nenhuma tabela encontrada.');
    }

    // 2. Buscar procedures relacionadas
    console.log('\n\n═'.repeat(80));
    console.log('\n🔧 PROCEDURES RELACIONADAS A CONTAS A RECEBER:\n');
    
    const queryProcs = `
      SELECT object_name, object_type, status, created, last_ddl_time
      FROM all_objects 
      WHERE owner = 'GERAL'
        AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (UPPER(object_name) LIKE '%RECEB%' 
         OR UPPER(object_name) LIKE '%TITULO%' 
         OR UPPER(object_name) LIKE '%DUPLICATA%'
         OR UPPER(object_name) LIKE '%CONTA%'
         OR UPPER(object_name) LIKE '%FATURA%'
         OR UPPER(object_name) LIKE '%PARCELA%'
         OR UPPER(object_name) LIKE '%BOLETO%')
      ORDER BY object_type, object_name
    `;

    const procsResult = await connection.execute(queryProcs);

    if (procsResult.rows.length > 0) {
      procsResult.rows.forEach((row, index) => {
        const status = row[2] === 'VALID' ? '✅' : '❌';
        console.log(`${index + 1}. ${status} [${row[1]}] ${row[0]}`);
        console.log(`   Criado: ${row[3]} | Modificado: ${row[4]}`);
      });
    } else {
      console.log('Nenhuma procedure encontrada.');
    }

    // 3. Buscar triggers relacionados
    console.log('\n\n═'.repeat(80));
    console.log('\n⚡ TRIGGERS RELACIONADOS:\n');
    
    const queryTriggers = `
      SELECT trigger_name, table_name, triggering_event, status
      FROM all_triggers 
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%RECEB%' 
         OR UPPER(table_name) LIKE '%TITULO%' 
         OR UPPER(table_name) LIKE '%DUPLICATA%'
         OR UPPER(table_name) LIKE '%CONTA%'
         OR UPPER(table_name) LIKE '%FATURA%')
      ORDER BY table_name, trigger_name
    `;

    const triggersResult = await connection.execute(queryTriggers);

    if (triggersResult.rows.length > 0) {
      triggersResult.rows.forEach((row, index) => {
        const status = row[3] === 'ENABLED' ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${row[0]}`);
        console.log(`   Tabela: ${row[1]} | Evento: ${row[2]}`);
      });
    } else {
      console.log('Nenhum trigger encontrado.');
    }

    // 4. Analisar estrutura de algumas tabelas principais (se existirem)
    console.log('\n\n═'.repeat(80));
    console.log('\n📋 ESTRUTURA DAS PRINCIPAIS TABELAS:\n');

    const tabelasPrincipais = ['DBCONTA', 'DBRECEBER', 'DBTITULO', 'DBDUPLICATA', 'DBFATURA', 'DBPARCELA'];
    
    for (const tabela of tabelasPrincipais) {
      const queryColunas = `
        SELECT column_name, data_type, data_length, nullable
        FROM all_tab_columns
        WHERE owner = 'GERAL'
          AND table_name = :tabela
        ORDER BY column_id
      `;

      const colunas = await connection.execute(queryColunas, [tabela]);

      if (colunas.rows.length > 0) {
        console.log(`\n🔸 ${tabela}:`);
        colunas.rows.forEach(col => {
          const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
          console.log(`   - ${col[0].padEnd(30)} ${col[1]}(${col[2]}) ${nullable}`);
        });
      }
    }

    // 5. Buscar views relacionadas
    console.log('\n\n═'.repeat(80));
    console.log('\n👁️  VIEWS RELACIONADAS:\n');
    
    const queryViews = `
      SELECT view_name, text_length
      FROM all_views 
      WHERE owner = 'GERAL'
        AND (UPPER(view_name) LIKE '%RECEB%' 
         OR UPPER(view_name) LIKE '%TITULO%' 
         OR UPPER(view_name) LIKE '%DUPLICATA%'
         OR UPPER(view_name) LIKE '%CONTA%')
      ORDER BY view_name
    `;

    const viewsResult = await connection.execute(queryViews);

    if (viewsResult.rows.length > 0) {
      viewsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0]} (${row[1]} bytes)`);
      });
    } else {
      console.log('Nenhuma view encontrada.');
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
investigarContasReceber();

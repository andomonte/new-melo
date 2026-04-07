/**
 * Script para buscar funcionalidades de importação de arquivos de operadoras
 * (Cielo, Getnet, Rede, Stone, etc)
 * 
 * Objetivo: Verificar se existe importação de arquivos EDI/conciliação de cartões
 */

const oracledb = require('oracledb');

async function buscarImportacaoOperadoras() {
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

    // 1. Buscar tabelas relacionadas a operadoras/cartões
    console.log('\n📊 TABELAS RELACIONADAS A OPERADORAS/CARTÕES:\n');
    
    const queryTabelas = `
      SELECT table_name, num_rows
      FROM all_tables 
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%CIELO%' 
         OR UPPER(table_name) LIKE '%GETNET%'
         OR UPPER(table_name) LIKE '%REDE%'
         OR UPPER(table_name) LIKE '%STONE%'
         OR UPPER(table_name) LIKE '%OPERADORA%'
         OR UPPER(table_name) LIKE '%CARTAO%'
         OR UPPER(table_name) LIKE '%CREDITO%'
         OR UPPER(table_name) LIKE '%DEBITO%'
         OR UPPER(table_name) LIKE '%EDI%'
         OR UPPER(table_name) LIKE '%CONCILIA%'
         OR UPPER(table_name) LIKE '%TEF%'
         OR UPPER(table_name) LIKE '%POS%')
      ORDER BY table_name
    `;

    const tabelasResult = await connection.execute(queryTabelas);

    if (tabelasResult.rows.length > 0) {
      tabelasResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0].padEnd(40)} (${row[1] || 0} registros)`);
      });
    } else {
      console.log('❌ Nenhuma tabela encontrada.');
    }

    // 2. Buscar procedures relacionadas
    console.log('\n\n═'.repeat(80));
    console.log('\n🔧 PROCEDURES RELACIONADAS A OPERADORAS/IMPORTAÇÃO:\n');
    
    const queryProcs = `
      SELECT object_name, object_type, status, created, last_ddl_time
      FROM all_objects 
      WHERE owner = 'GERAL'
        AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (UPPER(object_name) LIKE '%CIELO%' 
         OR UPPER(object_name) LIKE '%GETNET%'
         OR UPPER(object_name) LIKE '%REDE%'
         OR UPPER(object_name) LIKE '%STONE%'
         OR UPPER(object_name) LIKE '%OPERADORA%'
         OR UPPER(object_name) LIKE '%CARTAO%'
         OR UPPER(object_name) LIKE '%CREDITO%'
         OR UPPER(object_name) LIKE '%DEBITO%'
         OR UPPER(object_name) LIKE '%EDI%'
         OR UPPER(object_name) LIKE '%CONCILIA%'
         OR UPPER(object_name) LIKE '%IMPORT%'
         OR UPPER(object_name) LIKE '%TEF%'
         OR UPPER(object_name) LIKE '%POS%')
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
      console.log('❌ Nenhuma procedure encontrada.');
    }

    // 3. Buscar views relacionadas
    console.log('\n\n═'.repeat(80));
    console.log('\n👁️  VIEWS RELACIONADAS:\n');
    
    const queryViews = `
      SELECT view_name, text_length
      FROM all_views 
      WHERE owner = 'GERAL'
        AND (UPPER(view_name) LIKE '%CIELO%' 
         OR UPPER(view_name) LIKE '%GETNET%'
         OR UPPER(view_name) LIKE '%REDE%'
         OR UPPER(view_name) LIKE '%OPERADORA%'
         OR UPPER(view_name) LIKE '%CARTAO%'
         OR UPPER(view_name) LIKE '%EDI%'
         OR UPPER(view_name) LIKE '%CONCILIA%')
      ORDER BY view_name
    `;

    const viewsResult = await connection.execute(queryViews);

    if (viewsResult.rows.length > 0) {
      viewsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0]} (${row[1]} bytes)`);
      });
    } else {
      console.log('❌ Nenhuma view encontrada.');
    }

    // 4. Buscar tabelas genéricas de importação/arquivo
    console.log('\n\n═'.repeat(80));
    console.log('\n📁 TABELAS DE IMPORTAÇÃO DE ARQUIVOS (GENÉRICAS):\n');
    
    const queryArquivos = `
      SELECT table_name, num_rows
      FROM all_tables 
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%IMPORT%' 
         OR UPPER(table_name) LIKE '%ARQUIVO%'
         OR UPPER(table_name) LIKE '%UPLOAD%'
         OR UPPER(table_name) LIKE '%CARGA%'
         OR UPPER(table_name) LIKE '%INTEGRA%')
      ORDER BY table_name
    `;

    const arquivosResult = await connection.execute(queryArquivos);

    if (arquivosResult.rows.length > 0) {
      arquivosResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0].padEnd(40)} (${row[1] || 0} registros)`);
      });
    } else {
      console.log('Nenhuma tabela genérica encontrada.');
    }

    // 5. Buscar procedures de importação genéricas
    console.log('\n\n═'.repeat(80));
    console.log('\n⚙️  PROCEDURES DE IMPORTAÇÃO (GENÉRICAS):\n');
    
    const queryProcsImport = `
      SELECT object_name, object_type, status
      FROM all_objects 
      WHERE owner = 'GERAL'
        AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (UPPER(object_name) LIKE '%IMPORT%' 
         OR UPPER(object_name) LIKE '%CARGA%'
         OR UPPER(object_name) LIKE '%INTEGRA%'
         OR UPPER(object_name) LIKE '%PROCESSA%'
         OR UPPER(object_name) LIKE '%LER_%'
         OR UPPER(object_name) LIKE '%UPLOAD%')
      ORDER BY object_name
    `;

    const procsImportResult = await connection.execute(queryProcsImport);

    if (procsImportResult.rows.length > 0) {
      procsImportResult.rows.forEach((row, index) => {
        const status = row[2] === 'VALID' ? '✅' : '❌';
        console.log(`${index + 1}. ${status} [${row[1]}] ${row[0]}`);
      });
    } else {
      console.log('Nenhuma procedure genérica encontrada.');
    }

    // 6. Buscar por tipos de recebimento/bandeiras
    console.log('\n\n═'.repeat(80));
    console.log('\n💳 BUSCA POR BANDEIRAS/TIPOS DE RECEBIMENTO:\n');
    
    const queryBandeiras = `
      SELECT table_name
      FROM all_tables 
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%VISA%' 
         OR UPPER(table_name) LIKE '%MASTER%'
         OR UPPER(table_name) LIKE '%ELO%'
         OR UPPER(table_name) LIKE '%AMEX%'
         OR UPPER(table_name) LIKE '%HIPER%'
         OR UPPER(table_name) LIKE '%BANDEIRA%'
         OR UPPER(table_name) LIKE '%TIPO_REC%'
         OR UPPER(table_name) LIKE '%TIPOREC%')
      ORDER BY table_name
    `;

    const bandeirasResult = await connection.execute(queryBandeiras);

    if (bandeirasResult.rows.length > 0) {
      bandeirasResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0]}`);
      });
    } else {
      console.log('Nenhuma tabela de bandeira encontrada.');
    }

    console.log('\n\n═'.repeat(80));
    console.log('\n✅ Busca concluída!\n');

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
buscarImportacaoOperadoras();

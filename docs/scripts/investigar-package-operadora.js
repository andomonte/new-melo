/**
 * Script para investigar PACKAGE OPERADORA e tabela FIN_CARTAO_MENSAGEM_CIELO
 * 
 * Objetivo: Entender como funciona a integração com operadoras de cartão
 */

const oracledb = require('oracledb');

async function investigarOperadora() {
  let connection;

  try {
    // Tentar usar o Thick mode (Oracle Instant Client)
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível...');
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

    // 1. Ver código do PACKAGE OPERADORA
    console.log('\n📦 CÓDIGO DO PACKAGE OPERADORA:\n');
    
    const queryPackageSpec = `
      SELECT text
      FROM all_source
      WHERE owner = 'GERAL'
        AND name = 'OPERADORA'
        AND type = 'PACKAGE'
      ORDER BY line
    `;

    const packageSpecResult = await connection.execute(queryPackageSpec);

    if (packageSpecResult.rows.length > 0) {
      console.log('--- ESPECIFICAÇÃO (HEADER) ---\n');
      packageSpecResult.rows.forEach(row => {
        process.stdout.write(row[0]);
      });
    } else {
      console.log('Código não encontrado.');
    }

    // 2. Ver código do PACKAGE BODY OPERADORA
    console.log('\n\n═'.repeat(80));
    console.log('\n📦 CÓDIGO DO PACKAGE BODY OPERADORA:\n');
    
    const queryPackageBody = `
      SELECT text
      FROM all_source
      WHERE owner = 'GERAL'
        AND name = 'OPERADORA'
        AND type = 'PACKAGE BODY'
      ORDER BY line
    `;

    const packageBodyResult = await connection.execute(queryPackageBody);

    if (packageBodyResult.rows.length > 0) {
      console.log('--- IMPLEMENTAÇÃO (BODY) ---\n');
      let lineCount = 0;
      packageBodyResult.rows.forEach(row => {
        process.stdout.write(row[0]);
        lineCount++;
        // Limitar para não exibir muito código
        if (lineCount > 200) {
          console.log('\n\n... (código truncado após 200 linhas) ...\n');
          return;
        }
      });
    } else {
      console.log('Body não encontrado.');
    }

    // 3. Estrutura da tabela FIN_CARTAO_MENSAGEM_CIELO
    console.log('\n\n═'.repeat(80));
    console.log('\n📋 ESTRUTURA DA TABELA FIN_CARTAO_MENSAGEM_CIELO:\n');
    
    const queryColunasCielo = `
      SELECT column_name, data_type, data_length, nullable, data_default
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'FIN_CARTAO_MENSAGEM_CIELO'
      ORDER BY column_id
    `;

    const cieloResult = await connection.execute(queryColunasCielo);

    if (cieloResult.rows.length > 0) {
      cieloResult.rows.forEach(col => {
        const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
        const defaultVal = col[4] ? ` DEFAULT ${col[4]}` : '';
        console.log(`   ${col[0].padEnd(30)} ${col[1]}(${col[2]}) ${nullable}${defaultVal}`);
      });
    } else {
      console.log('Tabela não encontrada.');
    }

    // 4. Dados de exemplo da tabela
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 EXEMPLO DE DADOS EM FIN_CARTAO_MENSAGEM_CIELO:\n');
    
    const queryDadosCielo = `
      SELECT *
      FROM FIN_CARTAO_MENSAGEM_CIELO
      WHERE ROWNUM <= 5
    `;

    const dadosCieloResult = await connection.execute(queryDadosCielo);

    if (dadosCieloResult.rows.length > 0) {
      console.log('Colunas:', dadosCieloResult.metaData.map(m => m.name).join(' | '));
      console.log('─'.repeat(80));
      dadosCieloResult.rows.forEach((row, index) => {
        console.log(`Registro ${index + 1}:`, row);
      });
    } else {
      console.log('Nenhum dado encontrado na tabela.');
    }

    // 5. Buscar procedures que usam a tabela
    console.log('\n\n═'.repeat(80));
    console.log('\n🔍 PROCEDURES QUE USAM FIN_CARTAO_MENSAGEM_CIELO:\n');
    
    const queryProcsUsam = `
      SELECT DISTINCT name, type
      FROM all_source
      WHERE owner = 'GERAL'
        AND UPPER(text) LIKE '%FIN_CARTAO_MENSAGEM_CIELO%'
      ORDER BY name
    `;

    const procsUsamResult = await connection.execute(queryProcsUsam);

    if (procsUsamResult.rows.length > 0) {
      procsUsamResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. [${row[1]}] ${row[0]}`);
      });
    } else {
      console.log('Nenhuma procedure encontrada.');
    }

    // 6. Buscar outras tabelas relacionadas a cartão
    console.log('\n\n═'.repeat(80));
    console.log('\n💳 OUTRAS TABELAS RELACIONADAS A CARTÃO:\n');
    
    const queryTabelasCartao = `
      SELECT table_name, num_rows
      FROM all_tables
      WHERE owner = 'GERAL'
        AND (UPPER(table_name) LIKE '%CARTAO%'
         OR UPPER(table_name) LIKE '%CIELO%'
         OR UPPER(table_name) LIKE '%GETNET%'
         OR UPPER(table_name) LIKE '%ADQUIRENTE%')
      ORDER BY table_name
    `;

    const tabelasCartaoResult = await connection.execute(queryTabelasCartao);

    if (tabelasCartaoResult.rows.length > 0) {
      tabelasCartaoResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row[0].padEnd(40)} (${row[1] || 0} registros)`);
      });
    } else {
      console.log('Nenhuma tabela adicional encontrada.');
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
investigarOperadora();

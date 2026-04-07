/**
 * Script para ver estrutura completa das tabelas de cartão
 * FIN_CARTAO e FIN_CARTAO_RECEB
 */

const oracledb = require('oracledb');

async function verEstruturasCartao() {
  let connection;

  try {
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado...');
    }

    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    console.log('Conectando ao Oracle...');
    connection = await oracledb.getConnection(config);
    console.log('✅ Conectado!\n');
    console.log('═'.repeat(80));

    // 1. Estrutura FIN_CARTAO
    console.log('\n📋 ESTRUTURA COMPLETA: FIN_CARTAO\n');
    
    const queryColunasFIN = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'FIN_CARTAO'
      ORDER BY column_id
    `;

    const finCartaoResult = await connection.execute(queryColunasFIN);

    if (finCartaoResult.rows.length > 0) {
      finCartaoResult.rows.forEach(col => {
        const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
        console.log(`   ${col[0].padEnd(35)} ${col[1].padEnd(12)} (${String(col[2]).padStart(4)}) ${nullable}`);
      });
    }

    // 2. Exemplo de dados FIN_CARTAO
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 EXEMPLO DE DADOS: FIN_CARTAO (3 registros)\n');
    
    const queryDadosFIN = `
      SELECT *
      FROM FIN_CARTAO
      WHERE ROWNUM <= 3
      ORDER BY CAR_DATA DESC
    `;

    const dadosFINResult = await connection.execute(queryDadosFIN);

    if (dadosFINResult.rows.length > 0) {
      console.log('Colunas:');
      dadosFINResult.metaData.forEach((m, i) => {
        console.log(`  [${i}] ${m.name}`);
      });
      console.log('\n' + '─'.repeat(80));
      dadosFINResult.rows.forEach((row, index) => {
        console.log(`\nRegistro ${index + 1}:`);
        row.forEach((val, i) => {
          console.log(`  [${i}] ${dadosFINResult.metaData[i].name}: ${val}`);
        });
      });
    }

    // 3. Estrutura FIN_CARTAO_RECEB
    console.log('\n\n═'.repeat(80));
    console.log('\n📋 ESTRUTURA COMPLETA: FIN_CARTAO_RECEB\n');
    
    const queryColunasCR = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'FIN_CARTAO_RECEB'
      ORDER BY column_id
    `;

    const finCartaoRecebResult = await connection.execute(queryColunasCR);

    if (finCartaoRecebResult.rows.length > 0) {
      finCartaoRecebResult.rows.forEach(col => {
        const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
        console.log(`   ${col[0].padEnd(35)} ${col[1].padEnd(12)} (${String(col[2]).padStart(4)}) ${nullable}`);
      });
    }

    // 4. Exemplo de dados FIN_CARTAO_RECEB
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 EXEMPLO DE DADOS: FIN_CARTAO_RECEB (3 registros)\n');
    
    const queryDadosCR = `
      SELECT *
      FROM FIN_CARTAO_RECEB
      WHERE ROWNUM <= 3
    `;

    const dadosCRResult = await connection.execute(queryDadosCR);

    if (dadosCRResult.rows.length > 0) {
      console.log('Colunas:');
      dadosCRResult.metaData.forEach((m, i) => {
        console.log(`  [${i}] ${m.name}`);
      });
      console.log('\n' + '─'.repeat(80));
      dadosCRResult.rows.forEach((row, index) => {
        console.log(`\nRegistro ${index + 1}:`);
        row.forEach((val, i) => {
          console.log(`  [${i}] ${dadosCRResult.metaData[i].name}: ${val}`);
        });
      });
    }

    // 5. Procedures relacionadas
    console.log('\n\n═'.repeat(80));
    console.log('\n🔧 PROCEDURES QUE USAM FIN_CARTAO:\n');
    
    const queryProcs = `
      SELECT DISTINCT name, type
      FROM all_source
      WHERE owner = 'GERAL'
        AND (UPPER(text) LIKE '%FIN_CARTAO%'
         OR UPPER(text) LIKE '%FINCARTAO%')
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      ORDER BY type, name
    `;

    const procsResult = await connection.execute(queryProcs);

    if (procsResult.rows.length > 0) {
      procsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. [${row[1]}] ${row[0]}`);
      });
    } else {
      console.log('Nenhuma procedure encontrada.');
    }

    // 6. Buscar tabela DBOPERA (operadoras)
    console.log('\n\n═'.repeat(80));
    console.log('\n🏦 ESTRUTURA: DBOPERA (Cadastro de Operadoras)\n');
    
    const queryColunasOPERA = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBOPERA'
      ORDER BY column_id
    `;

    const operaResult = await connection.execute(queryColunasOPERA);

    if (operaResult.rows.length > 0) {
      operaResult.rows.forEach(col => {
        const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
        console.log(`   ${col[0].padEnd(35)} ${col[1].padEnd(12)} (${String(col[2]).padStart(4)}) ${nullable}`);
      });
    }

    // 7. Operadoras cadastradas
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 OPERADORAS CADASTRADAS:\n');
    
    const queryOperadoras = `
      SELECT CODOPERA, DESCR, TXOPERA, PZOPERA, COND_PAGTO, DESATIVADO
      FROM DBOPERA
      WHERE DESATIVADO = 0
      ORDER BY CODOPERA
    `;

    const operadorasResult = await connection.execute(queryOperadoras);

    if (operadorasResult.rows.length > 0) {
      operadorasResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. [${row[0]}] ${row[1]}`);
        console.log(`   Taxa: ${row[2]}% | Prazo: ${row[3]} dias | Cond.Pagto: ${row[4]}`);
      });
    } else {
      console.log('Nenhuma operadora ativa encontrada.');
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

verEstruturasCartao();

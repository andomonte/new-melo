/**
 * Script para investigar FIN_CARTAO e sistema de importação
 * 
 * Objetivo: Entender como funciona a importação de arquivos das operadoras
 */

const oracledb = require('oracledb');

async function investigarFinCartao() {
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
    console.log('\n📋 ESTRUTURA DA TABELA FIN_CARTAO:\n');
    
    const queryEstrutura = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL' AND table_name = 'FIN_CARTAO'
      ORDER BY column_id
    `;

    const estrutura = await connection.execute(queryEstrutura);
    estrutura.rows.forEach(col => {
      const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
      console.log(`   ${col[0].padEnd(30)} ${col[1].padEnd(15)} ${nullable}`);
    });

    // 2. Amostra de dados FIN_CARTAO
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 AMOSTRA DE DADOS FIN_CARTAO (últimos 5):\n');

    const queryAmostra = `
      SELECT * FROM (
        SELECT f.*, o.DESCR as OPERADORA_NOME
        FROM GERAL.FIN_CARTAO f
        LEFT JOIN GERAL.DBOPERA o ON f.CAR_CODOPERADORA = o.CODOPERA
        ORDER BY f.CAR_ID DESC
      ) WHERE ROWNUM <= 5
    `;

    const amostra = await connection.execute(queryAmostra);
    
    amostra.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Transação:`);
      amostra.metaData.forEach((meta, colIndex) => {
        const value = row[colIndex];
        if (value !== null && value !== undefined) {
          let displayValue = value;
          if (value instanceof Date) {
            displayValue = value.toLocaleString('pt-BR');
          }
          console.log(`   ${meta.name.padEnd(25)}: ${displayValue}`);
        }
      });
    });

    // 3. Estrutura FIN_CARTAO_RECEB
    console.log('\n\n═'.repeat(80));
    console.log('\n📋 ESTRUTURA DA TABELA FIN_CARTAO_RECEB:\n');

    const queryEstruturaReceb = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL' AND table_name = 'FIN_CARTAO_RECEB'
      ORDER BY column_id
    `;

    const estruturaReceb = await connection.execute(queryEstruturaReceb);
    estruturaReceb.rows.forEach(col => {
      const nullable = col[3] === 'Y' ? 'NULL' : 'NOT NULL';
      console.log(`   ${col[0].padEnd(30)} ${col[1].padEnd(15)} ${nullable}`);
    });

    // 4. Procedures de importação
    console.log('\n\n═'.repeat(80));
    console.log('\n🔧 PROCEDURES DE IMPORTAÇÃO DE CARTÃO:\n');

    const queryProcsImport = `
      SELECT DISTINCT name, type
      FROM all_source
      WHERE owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (UPPER(text) LIKE '%IMPORT%CARTAO%'
         OR UPPER(text) LIKE '%CARTAO%IMPORT%'
         OR UPPER(text) LIKE '%FIN_CARTAO%'
         OR UPPER(name) LIKE '%CARTAO%'
         OR UPPER(name) LIKE '%OPERADORA%')
      ORDER BY type, name
    `;

    const procsImport = await connection.execute(queryProcsImport);
    
    if (procsImport.rows.length > 0) {
      procsImport.rows.forEach(row => {
        console.log(`   [${row[1]}] ${row[0]}`);
      });
    }

    // 5. Ver package OPERADORA
    console.log('\n\n═'.repeat(80));
    console.log('\n📦 CONTEÚDO DO PACKAGE OPERADORA:\n');

    const queryPackageOper = `
      SELECT text, line
      FROM all_source
      WHERE owner = 'GERAL'
        AND name = 'OPERADORA'
        AND type = 'PACKAGE'
      ORDER BY line
    `;

    const packageOper = await connection.execute(queryPackageOper);
    
    if (packageOper.rows.length > 0) {
      packageOper.rows.forEach(row => {
        console.log(`${String(row[1]).padStart(3)}: ${row[0].trimEnd()}`);
      });
    }

    // 6. Estatísticas por operadora
    console.log('\n\n═'.repeat(80));
    console.log('\n📈 ESTATÍSTICAS POR OPERADORA:\n');

    const queryStats = `
      SELECT 
        o.CODOPERA,
        o.DESCR,
        COUNT(f.CAR_ID) as TOTAL_TRANSACOES,
        SUM(f.CAR_VALOR) as VALOR_TOTAL,
        MIN(f.CAR_DATA) as PRIMEIRA_TRANSACAO,
        MAX(f.CAR_DATA) as ULTIMA_TRANSACAO
      FROM GERAL.DBOPERA o
      LEFT JOIN GERAL.FIN_CARTAO f ON o.CODOPERA = f.CAR_CODOPERADORA
      GROUP BY o.CODOPERA, o.DESCR
      HAVING COUNT(f.CAR_ID) > 0
      ORDER BY COUNT(f.CAR_ID) DESC
    `;

    const stats = await connection.execute(queryStats);
    
    if (stats.rows.length > 0) {
      stats.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row[0]} - ${row[1]}`);
        console.log(`   Transações: ${row[2]}`);
        console.log(`   Valor Total: R$ ${(row[3] || 0).toFixed(2)}`);
        if (row[4]) console.log(`   Primeira: ${row[4].toLocaleDateString('pt-BR')}`);
        if (row[5]) console.log(`   Última: ${row[5].toLocaleDateString('pt-BR')}`);
      });
    } else {
      console.log('   Nenhuma transação encontrada');
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

investigarFinCartao();

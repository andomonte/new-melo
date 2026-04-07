const oracledb = require('oracledb');

// Forçar modo Thick para compatibilidade com Oracle 11g
oracledb.initOracleClient();

async function verificarTabelasOracle() {
  let connection;
  
  try {
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log('\n🔍 Verificando tabelas de retorno no Oracle (schema GERAL)...\n');

    // Buscar todas as tabelas que começam com DBRETORNO
    const result = await connection.execute(
      `SELECT table_name, num_rows 
       FROM user_tables 
       WHERE table_name LIKE 'DBRETORNO%' 
       ORDER BY table_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma tabela DBRETORNO* encontrada no Oracle!');
    } else {
      console.log('📋 Tabelas encontradas no Oracle:');
      console.log('═'.repeat(60));
      
      for (const row of result.rows) {
        console.log(`✅ ${row.TABLE_NAME.padEnd(40)} ${row.NUM_ROWS || 0} linhas`);
        
        // Buscar colunas de cada tabela
        const columns = await connection.execute(
          `SELECT column_name, data_type, data_length, nullable
           FROM user_tab_columns 
           WHERE table_name = :tableName 
           ORDER BY column_id`,
          [row.TABLE_NAME],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        
        console.log(`   Colunas (${columns.rows.length}):`);
        columns.rows.forEach((col, idx) => {
          const nullable = col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL';
          const type = col.DATA_TYPE === 'NUMBER' ? 'NUMBER' : 
                      col.DATA_TYPE === 'VARCHAR2' ? `VARCHAR2(${col.DATA_LENGTH})` :
                      col.DATA_TYPE === 'DATE' ? 'DATE' : col.DATA_TYPE;
          console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
        });
        console.log('');
      }
      
      console.log('═'.repeat(60));
      console.log(`\n📊 Total: ${result.rows.length} tabela(s) de retorno no Oracle\n`);
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err.message);
      }
    }
  }
}

verificarTabelasOracle();

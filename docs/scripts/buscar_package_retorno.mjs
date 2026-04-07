import oracledb from 'oracledb';

async function buscarPackageRetorno() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    console.log('✅ Conectado ao Oracle');

    // Buscar código da package RETORNO
    const result = await connection.execute(
      `SELECT text 
       FROM all_source 
       WHERE name = 'RETORNO' 
       AND owner = 'MANAUS'
       ORDER BY type, line`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length > 0) {
      console.log('\n================================================================================');
      console.log('📄 PACKAGE RETORNO - Código Completo');
      console.log('================================================================================\n');
      
      result.rows.forEach(row => {
        process.stdout.write(row.TEXT);
      });
      
      console.log('\n\n✅ Código extraído com sucesso!');
    } else {
      console.log('❌ Package RETORNO não encontrada');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    if (connection) {
      await connection.close();
      console.log('\n✅ Conexão fechada');
    }
  }
}

buscarPackageRetorno();

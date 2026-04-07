import oracledb from 'oracledb';

// Configurar o Oracle Instant Client
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });

async function buscarConciliacao() {
  let connection;

  try {
    // Conectar ao banco Oracle
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log('Conectado ao Oracle! Buscando procedures de conciliação...\n');

    // Buscar o pacote CONTASR completo (contém a procedure de conciliação)
    const query = `
      SELECT 
        LINE,
        TEXT
      FROM ALL_SOURCE
      WHERE NAME = 'CONTASR'
        AND TYPE = 'PACKAGE BODY'
        AND OWNER = 'GERAL'
        AND LINE BETWEEN 1100 AND 1300
      ORDER BY LINE
    `;

    const result = await connection.execute(query);

    if (result.rows.length === 0) {
      console.log('Nenhum código encontrado.');
    } else {
      console.log(`\nEncontradas ${result.rows.length} linhas do pacote CONTASR:\n`);
      console.log('='.repeat(80));
      
      result.rows.forEach(row => {
        const [line, text] = row;
        console.log(`${String(line).padStart(4, ' ')}: ${text}`);
      });
    }

  } catch (err) {
    console.error('Erro ao buscar procedures:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n\nConexão fechada.');
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

buscarConciliacao();

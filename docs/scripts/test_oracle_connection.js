const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function run() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: "GERAL",
      password: "123",
      connectString: "201.64.221.132:1524/desenv.mns.melopecas.com.br"
    });

    console.log("Conexão com Oracle bem-sucedida!");

    // You can run a simple query here to confirm
    const result = await connection.execute("SELECT SYSDATE FROM DUAL");
    console.log("Data do sistema Oracle:", result.rows[0].SYSDATE);

  } catch (err) {
    console.error("Erro ao conectar ou consultar Oracle:", err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log("Conexão Oracle encerrada.");
      } catch (err) {
        console.error("Erro ao encerrar conexão Oracle:", err);
      }
    }
  }
}

run();

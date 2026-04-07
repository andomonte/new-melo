const { Pool } = require('pg');

async function run() {
  let pool;

  try {
    // Usando a DATABASE_URL completa como string de conexão
    const connectionString = "postgresql://postgres:melodb@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15";
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false } // Adicionado para tentar contornar problemas de SSL
    });

    console.log("Tentando conectar ao PostgreSQL...");
    const client = await pool.connect();
    console.log("Conexão com PostgreSQL bem-sucedida!");

    // Executar uma consulta simples para confirmar
    const result = await client.query("SELECT NOW() as current_time");
    console.log("Data/Hora atual do PostgreSQL:", result.rows[0].current_time);

    client.release();

  } catch (err) {
    console.error("Erro ao conectar ou consultar PostgreSQL:", err);
  } finally {
    if (pool) {
      try {
        await pool.end();
        console.log("Pool de conexão PostgreSQL encerrado.");
      } catch (err) {
        console.error("Erro ao encerrar pool de conexão PostgreSQL:", err);
      }
    }
  }
}

run();

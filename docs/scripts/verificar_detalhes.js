const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarDetalhes() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Verificar se há registros na tabela dbremessa_detalhe
    const result = await client.query('SELECT COUNT(*) as total FROM db_manaus.dbremessa_detalhe');
    console.log('Total de registros em dbremessa_detalhe:', result.rows[0].total);

    // Verificar últimos registros
    const ultimos = await client.query('SELECT "CODREMESSA_DETALHE", "CODREMESSA", "CODCLI", "CODRECEB", "VALOR" FROM db_manaus.dbremessa_detalhe ORDER BY "CODREMESSA_DETALHE" DESC LIMIT 3');
    console.log('Últimos registros:');
    ultimos.rows.forEach(row => {
      console.log({
        CODREMESSA_DETALHE: row.CODREMESSA_DETALHE,
        CODREMESSA: row.CODREMESSA,
        CODCLI: row.CODCLI,
        CODRECEB: row.CODRECEB,
        VALOR: row.VALOR
      });
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

verificarDetalhes();
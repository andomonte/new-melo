const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkRecentData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Verificando dados recentes das tabelas de remessa...\n');

    // Verificar arquivos recentes
    console.log('=== dbremessa_arquivo (registros mais recentes) ===');
    const arquivoResult = await client.query(`
      SELECT codremessa, banco, data_gerado, nome_arquivo, usuario_importacao
      FROM db_manaus.dbremessa_arquivo
      ORDER BY data_gerado DESC
      LIMIT 3;
    `);

    arquivoResult.rows.forEach(row => {
      console.log(`📄 Remessa ${row.codremessa}: ${row.nome_arquivo} - ${row.banco} - ${row.data_gerado} (${row.usuario_importacao})`);
    });

    // Verificar detalhes recentes
    console.log('\n=== dbremessa_detalhe (últimos registros) ===');
    const detalheResult = await client.query(`
      SELECT "CODREMESSA", "CODREMESSA_DETALHE", "CODCLI", "DOCUMENTO", "VALOR", "NROBANCO"
      FROM db_manaus.dbremessa_detalhe
      ORDER BY "CODREMESSA_DETALHE" DESC
      LIMIT 5;
    `);

    detalheResult.rows.forEach(row => {
      console.log(`📋 Detalhe ${row.CODREMESSA_DETALHE} (Remessa ${row.CODREMESSA}): Cliente ${row.CODCLI} - Doc ${row.DOCUMENTO} - R$ ${row.VALOR} - Banco ${row.NROBANCO}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

checkRecentData();
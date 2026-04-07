async function testarRemessa() {
  try {
    const response = await fetch('http://localhost:3000/api/remessa/equifax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dtini: '2013-05-01',
        dtfim: '2013-05-31'
      })
    });

    if (response.ok) {
      const content = await response.text();
      console.log('✅ Remessa gerada com sucesso!');
      console.log('Conteúdo do arquivo:');
      console.log(content.substring(0, 500) + '...');

      // Verificar se foi salva no banco
      console.log('\n🔍 Verificando se foi salva no banco...');
      await verificarSalvamento();
    } else {
      const error = await response.json();
      console.log('❌ Erro:', error);
    }
  } catch (error) {
    console.log('❌ Erro de conexão:', error.message);
  }
}

async function verificarSalvamento() {
  const { Client } = require('pg');
  const dotenv = require('dotenv');
  dotenv.config();

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Verificar último registro na tabela arquivo
    const arquivoResult = await client.query(`
      SELECT codremessa, banco, data_gerado, nome_arquivo, usuario_importacao
      FROM db_manaus.dbremessa_arquivo
      ORDER BY data_gerado DESC
      LIMIT 1
    `);

    if (arquivoResult.rows.length > 0) {
      console.log('📄 Última remessa salva:', arquivoResult.rows[0]);
    }

    // Verificar detalhes
    const detalheResult = await client.query(`
      SELECT "CODREMESSA", COUNT(*) as total_detalhes
      FROM db_manaus.dbremessa_detalhe
      GROUP BY "CODREMESSA"
      ORDER BY "CODREMESSA" DESC
      LIMIT 1
    `);

    if (detalheResult.rows.length > 0) {
      console.log('📋 Detalhes da última remessa:', detalheResult.rows[0]);
    }

  } catch (error) {
    console.error('Erro ao verificar salvamento:', error);
  } finally {
    await client.end();
  }
}

testarRemessa();
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function showSampleData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Mostrando dados de exemplo das tabelas de remessa...\n');

    // Dados da tabela dbremessa_arquivo
    console.log('=== dbremessa_arquivo (últimos 5 registros) ===');
    const arquivoResult = await client.query(`
      SELECT codremessa, banco, data_gerado, nome_arquivo, usuario_importacao
      FROM db_manaus.dbremessa_arquivo
      ORDER BY data_gerado DESC
      LIMIT 5;
    `);

    if (arquivoResult.rows.length === 0) {
      console.log('❌ Nenhum registro encontrado na tabela dbremessa_arquivo');
    } else {
      arquivoResult.rows.forEach(row => {
        console.log(`📄 Remessa ${row.codremessa}: ${row.nome_arquivo} - ${row.banco} - ${row.data_gerado} (${row.usuario_importacao})`);
      });
    }

    // Dados da tabela dbremessa_detalhe
    console.log('\n=== dbremessa_detalhe (últimos 5 registros) ===');
    const detalheResult = await client.query(`
      SELECT "CODREMESSA", "CODREMESSA_DETALHE", "CODCLI", "DOCUMENTO", "VALOR", "NROBANCO"
      FROM db_manaus.dbremessa_detalhe
      ORDER BY "CODREMESSA_DETALHE" DESC
      LIMIT 5;
    `);

    if (detalheResult.rows.length === 0) {
      console.log('❌ Nenhum registro encontrado na tabela dbremessa_detalhe');
    } else {
      detalheResult.rows.forEach(row => {
        console.log(`📋 Detalhe ${row.CODREMESSA_DETALHE} (Remessa ${row.CODREMESSA}): Cliente ${row.CODCLI} - Doc ${row.DOCUMENTO} - R$ ${row.VALOR} - Banco ${row.NROBANCO}`);
      });
    }

    // Estatísticas
    console.log('\n=== Estatísticas ===');
    const statsArquivo = await client.query('SELECT COUNT(*) as total FROM db_manaus.dbremessa_arquivo');
    const statsDetalhe = await client.query('SELECT COUNT(*) as total FROM db_manaus.dbremessa_detalhe');

    console.log(`📊 Total de remessas: ${statsArquivo.rows[0].total}`);
    console.log(`📊 Total de detalhes: ${statsDetalhe.rows[0].total}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

showSampleData().catch(console.error);
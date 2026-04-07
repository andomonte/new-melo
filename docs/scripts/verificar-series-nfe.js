const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function verificarSeries() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  const client = await pool.connect();

  try {
    console.log('🔍 Verificando séries de NFe no banco...\n');

    // Buscar todas as tentativas de emissão
    const todasSeries = await client.query(
      `SELECT serie, nrodoc_fiscal, status, chave, motivo
       FROM db_manaus.dbfat_nfe 
       ORDER BY "data" DESC
       LIMIT 20`
    );

    console.log('📊 Últimas 20 tentativas de emissão:');
    todasSeries.rows.forEach((row, index) => {
      const statusIcon = row.status === '100' ? '✅' : '❌';
      console.log(`${index + 1}. ${statusIcon} Série: ${row.serie}, Número: ${row.nrodoc_fiscal}, Status: ${row.status}`);
      if (row.status !== '100') {
        console.log(`     Motivo: ${row.motivo ? row.motivo.substring(0, 80) + '...' : 'N/A'}`);
      }
    });

    // Agrupar por série
    const porSerie = await client.query(
      `SELECT serie, 
              COUNT(*) as total,
              COUNT(CASE WHEN status = '100' THEN 1 END) as autorizadas,
              COUNT(CASE WHEN status != '100' THEN 1 END) as rejeitadas
       FROM db_manaus.dbfat_nfe 
       GROUP BY serie
       ORDER BY serie`
    );

    console.log('\n📈 Estatísticas por série:');
    porSerie.rows.forEach((row) => {
      console.log(`  Série ${row.serie}: Total: ${row.total}, Autorizadas: ${row.autorizadas}, Rejeitadas: ${row.rejeitadas}`);
    });

    // Verificar chaves duplicadas
    const chavesDuplicadas = await client.query(
      `SELECT chave, COUNT(*) as vezes, 
              STRING_AGG(DISTINCT serie, ', ') as series,
              STRING_AGG(DISTINCT nrodoc_fiscal, ', ') as numeros
       FROM db_manaus.dbfat_nfe 
       GROUP BY chave
       HAVING COUNT(*) > 1`
    );

    if (chavesDuplicadas.rows.length > 0) {
      console.log('\n❌ Chaves duplicadas no banco:');
      chavesDuplicadas.rows.forEach((row) => {
        console.log(`  Chave: ${row.chave}`);
        console.log(`    Tentativas: ${row.vezes}x`);
        console.log(`    Séries: ${row.series}`);
        console.log(`    Números: ${row.numeros}`);
      });
    } else {
      console.log('\n✅ Nenhuma chave duplicada no banco local');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarSeries();

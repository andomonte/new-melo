const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function testTituloImportado() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🧪 Testando campo titulo_importado na tabela dbpgto...');

    const client = await pool.connect();

    // Verificar registros recentes com titulo_importado = true
    const result = await client.query(`
      SELECT
        cod_pgto,
        titulo_importado,
        tipo,
        cod_transp,
        obs,
        dt_emissao
      FROM db_manaus.dbpgto
      WHERE titulo_importado = true
      ORDER BY dt_emissao DESC
      LIMIT 5
    `);

    console.log('\n📊 Registros com titulo_importado = true:');
    console.log('================================================================================');
    if (result.rows.length === 0) {
      console.log('Nenhum registro encontrado com titulo_importado = true');
    } else {
      console.table(result.rows);
    }

    // Verificar registros recentes com titulo_importado = false ou null
    const resultFalse = await client.query(`
      SELECT
        cod_pgto,
        titulo_importado,
        tipo,
        cod_transp,
        obs,
        dt_emissao
      FROM db_manaus.dbpgto
      WHERE titulo_importado IS NULL OR titulo_importado = false
      ORDER BY dt_emissao DESC
      LIMIT 5
    `);

    console.log('\n📊 Registros com titulo_importado = false/null:');
    console.log('================================================================================');
    if (resultFalse.rows.length === 0) {
      console.log('Nenhum registro encontrado com titulo_importado = false/null');
    } else {
      console.table(resultFalse.rows);
    }

    client.release();

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await pool.end();
  }
}

testTituloImportado();
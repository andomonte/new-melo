const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkCodCredor() {
  const connectionString =
    process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;

  if (!connectionString) {
    console.error('❌ Nenhuma connection string encontrada');
    console.error(
      'Variáveis disponíveis:',
      Object.keys(process.env).filter((k) => k.includes('DATABASE')),
    );
    return;
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        cod_credor,
        nome,
        CAST(cod_credor AS INTEGER) as cod_num
      FROM db_manaus.dbcredor 
      ORDER BY CAST(cod_credor AS INTEGER) DESC 
      LIMIT 5
    `);

    console.log('🔍 Os 5 maiores cod_credor no banco:');
    console.log('='.repeat(60));
    result.rows.forEach((row, idx) => {
      console.log(
        `${idx + 1}. cod_credor: ${row.cod_credor} (num: ${row.cod_num}) - ${
          row.nome
        }`,
      );
    });
    console.log('='.repeat(60));

    if (result.rows.length > 0) {
      const maior = result.rows[0];
      const proximo = parseInt(maior.cod_credor, 10) + 1;
      console.log(`\n📊 Análise:`);
      console.log(`   Maior atual: ${maior.cod_credor}`);
      console.log(`   Próximo seria: ${proximo}`);
      console.log(
        `   Tamanho do próximo: ${proximo.toString().length} dígitos`,
      );

      if (proximo > 99999) {
        console.log(
          `   ⚠️  PROBLEMA: Próximo código (${proximo}) excede limite de 5 dígitos!`,
        );
      } else {
        console.log(`   ✅ OK: Ainda há espaço (limite: 99999)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkCodCredor().catch(console.error);

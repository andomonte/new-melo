require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificarCertificados() {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT
        cgc,
        nomecontribuinte,
        CASE WHEN "certificadoKey" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_certificado_key,
        CASE WHEN "certificadoCrt" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_certificado_crt,
        CASE WHEN "cadeiaCrt" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_cadeia_crt
      FROM dadosempresa
    `);

    console.log('=== VERIFICAÇÃO DE CERTIFICADOS ===');
    result.rows.forEach(row => {
      console.log(`Empresa: ${row.nomecontribuinte} (${row.cgc})`);
      console.log(`  Certificado Key: ${row.tem_certificado_key}`);
      console.log(`  Certificado CRT: ${row.tem_certificado_crt}`);
      console.log(`  Cadeia CRT: ${row.tem_cadeia_crt}`);
      console.log('---');
    });

    client.release();
  } catch (error) {
    console.error('Erro ao verificar certificados:', error);
  } finally {
    await pool.end();
  }
}

verificarCertificados();
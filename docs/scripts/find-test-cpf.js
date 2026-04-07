// Quick script to find a CPF/CNPJ in the database for testing
const { Pool } = require('pg');
require('dotenv').config();

async function findTestDocument() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_APP || process.env.DATABASE_URL,
  });

  try {
    // Get a few sample CPF/CNPJ from the database
    const result = await pool.query(`
      SELECT codcli, nome, cpfcgc, tipo 
      FROM dbclien 
      WHERE cpfcgc IS NOT NULL AND cpfcgc != ''
      LIMIT 5
    `);

    console.log('📋 Sample documents in database for testing:\n');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.nome}`);
      console.log(`   CPF/CNPJ: ${row.cpfcgc}`);
      console.log(`   Código: ${row.codcli}`);
      console.log(
        `   Tipo: ${
          row.tipo === 'F'
            ? 'Física'
            : row.tipo === 'J'
            ? 'Jurídica'
            : 'Exterior'
        }\n`,
      );
    });

    if (result.rows.length === 0) {
      console.log(
        '❌ No documents found in database. The database might be empty.',
      );
    } else {
      console.log(
        `\n💡 To test duplicate detection, try entering one of these CPF/CNPJ in the form.`,
      );
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findTestDocument();

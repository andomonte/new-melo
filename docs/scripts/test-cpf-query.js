// Test the exact query being used in the API
const { Pool } = require('pg');
require('dotenv').config();

async function testQuery() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_APP || process.env.DATABASE_URL,
  });

  const searchDoc = '70391436236';

  try {
    console.log('🔍 Testing query with searchDoc:', searchDoc);
    console.log('');

    // Test what's in the database first
    const rawData = await pool.query(`
      SELECT codcli, nome, cpfcgc, 
             regexp_replace(cpfcgc, '[^0-9]', '', 'g') as cleaned_cpf
      FROM dbclien 
      WHERE cpfcgc LIKE '%70391436236%'
      LIMIT 5
    `);

    console.log('📋 Raw data in database containing "70391436236":');
    rawData.rows.forEach((row) => {
      console.log(`  - ${row.nome}`);
      console.log(`    Original: "${row.cpfcgc}"`);
      console.log(`    Cleaned:  "${row.cleaned_cpf}"`);
      console.log(
        `    Match: ${row.cleaned_cpf === searchDoc ? '✅ YES' : '❌ NO'}`,
      );
      console.log('');
    });

    // Test the actual query
    const result = await pool.query(
      `
      SELECT codcli, nome, cpfcgc, tipo 
      FROM dbclien 
      WHERE regexp_replace(cpfcgc, '[^0-9]', '', 'g') = $1 
      LIMIT 1
    `,
      [searchDoc],
    );

    console.log('🔍 Query result with regexp_replace:');
    if (result.rows.length > 0) {
      console.log('✅ FOUND:', result.rows[0]);
    } else {
      console.log('❌ NOT FOUND');

      // Try alternative approach
      console.log('\n🔄 Trying alternative query...');
      const alt = await pool.query(`
        SELECT codcli, nome, cpfcgc, tipo,
               regexp_replace(cpfcgc, '[^0-9]', '', 'g') as cleaned
        FROM dbclien 
        WHERE regexp_replace(cpfcgc, '[^0-9]', '', 'g') = '70391436236'
        LIMIT 1
      `);

      if (alt.rows.length > 0) {
        console.log('✅ Found with hardcoded value:', alt.rows[0]);
      } else {
        console.log('❌ Still not found');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testQuery();

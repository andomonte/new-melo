const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkPgtoEnt() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Verificar estrutura da tabela dbpgto_ent
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto_ent'
      ORDER BY ordinal_position;
    `;

    const columnsResult = await client.query(columnsQuery);

    if (columnsResult.rows.length > 0) {
      console.log('✅ Tabela dbpgto_ent encontrada:');
      console.log('Estrutura:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Mostrar alguns registros de exemplo
      const sampleResult = await client.query('SELECT * FROM db_manaus.dbpgto_ent LIMIT 2;');
      if (sampleResult.rows.length > 0) {
        console.log('Exemplos de registros:');
        sampleResult.rows.forEach((row, index) => {
          console.log(`  Registro ${index + 1}:`, JSON.stringify(row, null, 2));
        });
      }
    } else {
      console.log('❌ Tabela dbpgto_ent não encontrada');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

checkPgtoEnt();
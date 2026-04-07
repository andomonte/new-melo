const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkDbpgtoColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Verificando colunas da tabela dbpgto...\n');

    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto'
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Tabela dbpgto não encontrada');
    } else {
      console.log(`✅ Encontradas ${result.rows.length} colunas:\n`);
      result.rows.forEach((col, index) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`${index + 1}. ${col.column_name}: ${col.data_type}${length} ${nullable}`);
      });

      // Verificar especificamente se cod_receb existe
      const hasCodeReceb = result.rows.some(col => col.column_name === 'cod_receb');
      console.log(`\n🔍 Coluna 'cod_receb' existe? ${hasCodeReceb ? '✅ SIM' : '❌ NÃO'}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkDbpgtoColumns();

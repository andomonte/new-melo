const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkTableStructure(tableName) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log(`\n=== Estrutura da tabela: ${tableName} ===`);

    const query = `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query, [tableName]);

    if (result.rows.length === 0) {
      console.log(`❌ Tabela '${tableName}' não encontrada!`);
      return;
    }

    console.log(`✅ Tabela encontrada com ${result.rows.length} colunas:\n`);

    result.rows.forEach(row => {
      console.log(`📋 ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}${row.numeric_precision ? `(${row.numeric_precision}${row.numeric_scale ? `,${row.numeric_scale}` : ''})` : ''} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

  } catch (error) {
    console.error(`❌ Erro ao consultar tabela ${tableName}:`, error.message);
  } finally {
    await client.end();
  }
}

async function checkTableExists(tableName) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'db_manaus'
          AND table_name = $1
      );
    `;

    const result = await client.query(query, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Erro ao verificar existência da tabela ${tableName}:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🔍 Verificando estrutura das tabelas de remessa...\n');

  try {
    // Verificar tabelas
    const tables = ['dbremessa_arquivo', 'dbremessa_detalhe'];

    for (const tableName of tables) {
      const exists = await checkTableExists(tableName);
      if (exists) {
        await checkTableStructure(tableName);
      } else {
        console.log(`❌ Tabela '${tableName}' NÃO existe no banco de dados!`);
      }
    }

    // Também verificar se existe a tabela de histórico que criamos
    const historicoExists = await checkTableExists('historico_remessa_equifax');
    if (historicoExists) {
      console.log('\n📋 Tabela de histórico encontrada:');
      await checkTableStructure('historico_remessa_equifax');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar o script
main().catch(console.error);
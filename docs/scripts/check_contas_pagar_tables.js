const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function listarTabelasContasPagar() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Buscando tabelas relacionadas a contas a pagar...\n');

    // Buscar todas as tabelas do schema db_manaus
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    const allTables = tablesResult.rows.map(row => row.table_name);

    console.log('📋 Todas as tabelas do schema db_manaus:');
    console.log(allTables.join(', '));
    console.log(`\n📊 Total: ${allTables.length} tabelas\n`);

    // Filtrar tabelas que podem estar relacionadas a contas a pagar
    const possiblePgtoTables = allTables.filter(table =>
      table.toLowerCase().includes('pgto') ||
      table.toLowerCase().includes('pagar') ||
      table.toLowerCase().includes('pagamento') ||
      table.toLowerCase().includes('conta') ||
      table.toLowerCase().includes('financeiro') ||
      table.toLowerCase().includes('despesa')
    );

    console.log('🎯 Tabelas possivelmente relacionadas a contas a pagar:');
    if (possiblePgtoTables.length > 0) {
      possiblePgtoTables.forEach(table => console.log(`- ${table}`));
    } else {
      console.log('Nenhuma tabela encontrada com nomes relacionados.');
    }

    // Verificar estrutura de tabelas específicas que podem existir
    const tablesToCheck = ['dbpgto', 'dbpgto1', 'dbpgto2', 'dbcontas_pagar', 'dbpagamento', 'dbdespesa'];

    for (const tableName of tablesToCheck) {
      try {
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'db_manaus'
            AND table_name = '${tableName}'
          ORDER BY ordinal_position;
        `;

        const columnsResult = await client.query(columnsQuery);

        if (columnsResult.rows.length > 0) {
          console.log(`\n✅ Tabela encontrada: ${tableName}`);
          console.log('Estrutura:');
          columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
          });

          // Mostrar alguns registros de exemplo
          const sampleQuery = `SELECT * FROM db_manaus.${tableName} LIMIT 3;`;
          const sampleResult = await client.query(sampleQuery);

          if (sampleResult.rows.length > 0) {
            console.log('Exemplos de registros:');
            sampleResult.rows.forEach((row, index) => {
              console.log(`  Registro ${index + 1}:`, JSON.stringify(row, null, 2));
            });
          }
        }
      } catch (error) {
        // Tabela não existe, continuar
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

listarTabelasContasPagar();
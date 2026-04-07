const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus'
  });

  try {
    console.log('Conectado ao PostgreSQL.\n');

    // Tabelas de interesse
    const tables = [
      'dbuf_n',
      'dbprod',
      'dbclien',
      'dbvenda',
      'dbitvenda',
      'dadosempresa',
      'dbclassificacao_fiscal',
      'db_ie'
    ];

    console.log('========================================');
    console.log('ESTRUTURA DAS TABELAS NO POSTGRESQL');
    console.log('========================================\n');

    for (const tableName of tables) {
      console.log(`\n--- Tabela: ${tableName.toUpperCase()} ---`);

      try {
        const result = await pool.query(`
          SELECT
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        if (result.rows.length > 0) {
          result.rows.forEach(row => {
            const colName = row.column_name;
            let dataType = row.data_type;

            if (row.character_maximum_length) {
              dataType += `(${row.character_maximum_length})`;
            } else if (row.numeric_precision) {
              dataType += `(${row.numeric_precision}${row.numeric_scale ? ',' + row.numeric_scale : ''})`;
            }

            const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : '';
            const defVal = row.column_default ? `DEFAULT ${row.column_default}` : '';

            console.log(`  ${colName.padEnd(35)} ${dataType.padEnd(25)} ${nullable.padEnd(10)} ${defVal}`);
          });
        } else {
          console.log(`  Tabela não encontrada.`);
        }
      } catch (e) {
        console.log(`  Erro: ${e.message}`);
      }
    }

    // Verificar se existem views ou funções relacionadas a impostos
    console.log('\n\n========================================');
    console.log('VIEWS RELACIONADAS A IMPOSTOS/NCM/MVA');
    console.log('========================================\n');

    const viewsResult = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND (UPPER(table_name) LIKE '%IMPOSTO%'
          OR UPPER(table_name) LIKE '%NCM%'
          OR UPPER(table_name) LIKE '%MVA%'
          OR UPPER(table_name) LIKE '%TRIBUT%'
          OR UPPER(table_name) LIKE '%ICMS%'
          OR UPPER(table_name) LIKE '%IPI%')
      ORDER BY table_name
    `);

    if (viewsResult.rows.length > 0) {
      console.log('Views encontradas:');
      viewsResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('Nenhuma view encontrada.');
    }

    // Verificar funções/procedures
    console.log('\n\n========================================');
    console.log('FUNÇÕES/PROCEDURES RELACIONADAS');
    console.log('========================================\n');

    const functionsResult = await pool.query(`
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND (UPPER(routine_name) LIKE '%IMPOSTO%'
          OR UPPER(routine_name) LIKE '%NCM%'
          OR UPPER(routine_name) LIKE '%ALIQUOTA%'
          OR UPPER(routine_name) LIKE '%MVA%'
          OR UPPER(routine_name) LIKE '%ICMS%'
          OR UPPER(routine_name) LIKE '%IPI%'
          OR UPPER(routine_name) LIKE '%IBS%'
          OR UPPER(routine_name) LIKE '%CBS%')
      ORDER BY routine_type, routine_name
    `);

    if (functionsResult.rows.length > 0) {
      console.log('Funções/Procedures encontradas:');
      functionsResult.rows.forEach(row => {
        console.log(`  - ${row.routine_type}: ${row.routine_name}`);
      });
    } else {
      console.log('Nenhuma função/procedure encontrada.');
    }

    // Buscar colunas de impostos em dbitvenda
    console.log('\n\n========================================');
    console.log('COLUNAS DE IMPOSTOS NA TABELA DBITVENDA');
    console.log('========================================\n');

    const itvendaResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'dbitvenda'
        AND (UPPER(column_name) LIKE '%ICMS%'
          OR UPPER(column_name) LIKE '%IPI%'
          OR UPPER(column_name) LIKE '%PIS%'
          OR UPPER(column_name) LIKE '%COFINS%'
          OR UPPER(column_name) LIKE '%ST%'
          OR UPPER(column_name) LIKE '%SUBST%'
          OR UPPER(column_name) LIKE '%MVA%'
          OR UPPER(column_name) LIKE '%FCP%'
          OR UPPER(column_name) LIKE '%CST%'
          OR UPPER(column_name) LIKE '%CFOP%'
          OR UPPER(column_name) LIKE '%NCM%'
          OR UPPER(column_name) LIKE '%BASE%')
      ORDER BY column_name
    `);

    if (itvendaResult.rows.length > 0) {
      console.log('Colunas de impostos encontradas em dbitvenda:');
      itvendaResult.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(40)} ${row.data_type}`);
      });
    }

    await pool.end();
    console.log('\n\nConsulta finalizada com sucesso!');
  } catch (err) {
    console.error('ERRO:', err);
    process.exit(1);
  }
}

main();

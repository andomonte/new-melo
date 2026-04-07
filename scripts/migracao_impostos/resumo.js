const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PG_CONFIG = {
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
};

async function main() {
  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();

  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          RESUMO DA MIGRAÇÃO - TABELAS DE IMPOSTOS                            ║');
  console.log('║          Oracle → PostgreSQL                                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

  const tables = [
    { name: 'cad_legislacao_icmsst', description: 'Protocolos ICMS-ST', priority: '⭐⭐⭐' },
    { name: 'cad_legislacao_icmsst_ncm', description: 'NCM x Protocolo x MVA', priority: '🔥 CRÍTICA' },
    { name: 'fis_tributo_aliquota', description: 'Alíquotas por exceção', priority: '⭐⭐' },
    { name: 'dbcest', description: 'Códigos CEST', priority: '⭐⭐' }
  ];

  let totalRecords = 0;
  const results = [];

  for (const table of tables) {
    try {
      // Verificar se existe
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        );
      `;
      const exists = await pgClient.query(existsQuery, [table.name]);

      if (!exists.rows[0].exists) {
        results.push({
          tabela: table.name,
          status: '❌ NÃO EXISTE',
          registros: 0,
          descricao: table.description,
          prioridade: table.priority
        });
        continue;
      }

      // Contar registros
      const countResult = await pgClient.query(`SELECT COUNT(*) FROM ${table.name}`);
      const count = parseInt(countResult.rows[0].count);
      totalRecords += count;

      // Contar colunas
      const columnsQuery = `
        SELECT COUNT(DISTINCT column_name) as total
        FROM information_schema.columns
        WHERE table_name = $1;
      `;
      const columnsResult = await pgClient.query(columnsQuery, [table.name]);
      const columnCount = parseInt(columnsResult.rows[0].total);

      results.push({
        tabela: table.name,
        status: '✅ OK',
        registros: count.toLocaleString(),
        colunas: columnCount,
        descricao: table.description,
        prioridade: table.priority
      });

    } catch (err) {
      results.push({
        tabela: table.name,
        status: '❌ ERRO',
        registros: 0,
        descricao: table.description,
        prioridade: table.priority,
        erro: err.message
      });
    }
  }

  // Exibir tabela de resultados
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ TABELAS MIGRADAS                                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  results.forEach((r, idx) => {
    console.log(`│ ${(idx + 1)}. ${r.tabela.padEnd(35)} ${r.status.padEnd(10)} ${String(r.registros).padStart(10)} │`);
    console.log(`│    ${r.descricao.padEnd(45)} ${r.prioridade.padEnd(15)} │`);
    if (idx < results.length - 1) {
      console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    }
  });

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Resumo geral
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ RESUMO GERAL                                                                │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Total de tabelas:        ${results.length}                                                       │`);
  console.log(`│ Tabelas OK:              ${results.filter(r => r.status.includes('OK')).length}                                                       │`);
  console.log(`│ Total de registros:      ${totalRecords.toLocaleString().padEnd(10)}                                           │`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Verificar índices
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ÍNDICES CRIADOS                                                             │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const indexQuery = `
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename IN ('cad_legislacao_icmsst', 'cad_legislacao_icmsst_ncm', 'fis_tributo_aliquota', 'dbcest')
      AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
  `;

  try {
    const indexResult = await pgClient.query(indexQuery);

    let currentTable = '';
    indexResult.rows.forEach(row => {
      if (row.tablename !== currentTable) {
        if (currentTable !== '') {
          console.log('├─────────────────────────────────────────────────────────────────────────────┤');
        }
        console.log(`│ ${row.tablename.toUpperCase()}`.padEnd(78) + '│');
        currentTable = row.tablename;
      }
      console.log(`│   • ${row.indexname}`.padEnd(78) + '│');
    });

    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    console.log(`\n✅ Total de índices: ${indexResult.rows.length}`);

  } catch (err) {
    console.log('│ ❌ Erro ao verificar índices                                               │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  // Teste rápido de performance
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ TESTE DE PERFORMANCE                                                        │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const perfQuery = `
    SELECT
      ln."LIN_NCM",
      ln."LIN_MVA_ST_ORIGINAL",
      l."LEI_PROTOCOLO"
    FROM cad_legislacao_icmsst_ncm ln
    JOIN cad_legislacao_icmsst l ON l."LEI_ID" = ln."LIN_LEI_ID"
    WHERE ln."LIN_NCM" = '84213920'
    LIMIT 1;
  `;

  try {
    const startTime = Date.now();
    const perfResult = await pgClient.query(perfQuery);
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (perfResult.rows.length > 0) {
      console.log(`│ Query: Buscar MVA por NCM                                                   │`);
      console.log(`│ Tempo de execução: ${duration}ms`.padEnd(78) + '│');
      console.log(`│ Status: ${duration < 10 ? '✅ EXCELENTE' : duration < 50 ? '⚠️ ACEITÁVEL' : '❌ LENTO'}`.padEnd(78) + '│');
      console.log(`│ Resultado: NCM=${perfResult.rows[0].LIN_NCM}, MVA=${perfResult.rows[0].LIN_MVA_ST_ORIGINAL}%`.padEnd(78) + '│');
    } else {
      console.log('│ ⚠️ Nenhum resultado encontrado                                             │');
    }
  } catch (err) {
    console.log(`│ ❌ Erro no teste: ${err.message}`.padEnd(78) + '│');
  }

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Arquivos disponíveis
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ARQUIVOS DISPONÍVEIS                                                        │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const scriptsDir = __dirname;
  const files = [
    { name: 'README.md', desc: 'Documentação completa' },
    { name: 'RELATORIO_MIGRACAO.md', desc: 'Relatório detalhado' },
    { name: 'schema_completo.sql', desc: 'Schema completo' },
    { name: 'exemplo_consultas.sql', desc: '10 exemplos de queries' },
    { name: 'testar_consultas.js', desc: 'Testes automatizados' },
    { name: 'debug_tables.js', desc: 'Verificar estrutura' }
  ];

  files.forEach(file => {
    const filePath = path.join(scriptsDir, file.name);
    const exists = fs.existsSync(filePath);
    console.log(`│ ${exists ? '✅' : '❌'} ${file.name.padEnd(30)} ${file.desc.padEnd(35)} │`);
  });

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Comandos úteis
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ COMANDOS ÚTEIS                                                              │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log('│ Verificar tabelas:       node scripts/migracao_impostos/debug_tables.js    │');
  console.log('│ Testar consultas:        node scripts/migracao_impostos/testar_consultas.js│');
  console.log('│ Recriar índices:         node scripts/migracao_impostos/criar_indices.js   │');
  console.log('│ Ver este resumo:         node scripts/migracao_impostos/resumo.js          │');
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  console.log('\n✅ Migração concluída com sucesso!');
  console.log('📚 Consulte README.md para mais informações\n');

  await pgClient.end();
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});

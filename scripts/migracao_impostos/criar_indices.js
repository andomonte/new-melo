const { Client } = require('pg');

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

  console.log('CRIANDO ÍNDICES PARA OTIMIZAÇÃO DE CONSULTAS\n');
  console.log('='.repeat(80));

  const indexes = [
    // CAD_LEGISLACAO_ICMSST
    {
      table: 'cad_legislacao_icmsst',
      name: 'idx_legislacao_icmsst_protocolo',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_protocolo ON cad_legislacao_icmsst("LEI_PROTOCOLO");'
    },
    {
      table: 'cad_legislacao_icmsst',
      name: 'idx_legislacao_icmsst_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_status ON cad_legislacao_icmsst("LEI_STATUS");'
    },

    // CAD_LEGISLACAO_ICMSST_NCM (CRÍTICO)
    {
      table: 'cad_legislacao_icmsst_ncm',
      name: 'idx_legislacao_ncm_ncm',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm ON cad_legislacao_icmsst_ncm("LIN_NCM");'
    },
    {
      table: 'cad_legislacao_icmsst_ncm',
      name: 'idx_legislacao_ncm_lei_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_lei_id ON cad_legislacao_icmsst_ncm("LIN_LEI_ID");'
    },
    {
      table: 'cad_legislacao_icmsst_ncm',
      name: 'idx_legislacao_ncm_ncm_lei',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm_lei ON cad_legislacao_icmsst_ncm("LIN_NCM", "LIN_LEI_ID");'
    },
    {
      table: 'cad_legislacao_icmsst_ncm',
      name: 'idx_legislacao_ncm_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_status ON cad_legislacao_icmsst_ncm("LIN_STATUS");'
    },
    {
      table: 'cad_legislacao_icmsst_ncm',
      name: 'idx_legislacao_ncm_cest',
      sql: 'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_cest ON cad_legislacao_icmsst_ncm("LIN_CEST");'
    },

    // FIS_TRIBUTO_ALIQUOTA
    {
      table: 'fis_tributo_aliquota',
      name: 'idx_tributo_aliquota_codigo',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tributo_aliquota_codigo ON fis_tributo_aliquota(codigo);'
    },

    // DBCEST
    {
      table: 'dbcest',
      name: 'idx_dbcest_cest',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dbcest_cest ON dbcest(cest);'
    },
    {
      table: 'dbcest',
      name: 'idx_dbcest_ncm',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dbcest_ncm ON dbcest(ncm);'
    },
    {
      table: 'dbcest',
      name: 'idx_dbcest_segmento',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dbcest_segmento ON dbcest(segmento);'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const index of indexes) {
    try {
      await pgClient.query(index.sql);
      console.log(`✓ ${index.name} (${index.table})`);
      successCount++;
    } catch (err) {
      console.log(`✗ ${index.name}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`RESUMO:`);
  console.log(`  Total de índices: ${indexes.length}`);
  console.log(`  Criados com sucesso: ${successCount}`);
  console.log(`  Erros: ${errorCount}`);
  console.log('='.repeat(80));

  await pgClient.end();
}

main().catch(console.error);

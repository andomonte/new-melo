const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus';

async function verificarDetalhes() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL\n');

    // Verificar todas as colunas da tabela de legislação
    console.log('=== Todas as colunas de cad_legislacao_icmsst ===');
    const cols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'cad_legislacao_icmsst'
      ORDER BY ordinal_position
    `);
    console.log(cols.rows.map(r => r.column_name).join(', '));

    // Verificar dados do protocolo 41 (que tem o NCM 84213920)
    console.log('\n\n=== Dados completos do Protocolo 41 (LEI_ID = 2) ===');
    const prot41 = await client.query(`
      SELECT * FROM db_manaus.cad_legislacao_icmsst WHERE "LEI_ID" = 2
    `);
    console.log(JSON.stringify(prot41.rows[0], null, 2));

    // Verificar NCM 84213920
    console.log('\n\n=== NCM 84213920 e suas legislações ===');
    const ncm = await client.query(`
      SELECT
        ln.*,
        l."LEI_PROTOCOLO",
        l."LEI_STATUS",
        l."LEI_DATA_VIGENCIA"
      FROM db_manaus.cad_legislacao_icmsst_ncm ln
      JOIN db_manaus.cad_legislacao_icmsst l ON l."LEI_ID" = ln."LIN_LEI_ID"
      WHERE ln."LIN_NCM" = '84213920'
    `);
    console.log(JSON.stringify(ncm.rows, null, 2));

    // Verificar se há tabela de UFs relacionada
    console.log('\n\n=== Verificando tabelas com padrão *uf* ou *estado* ===');
    const tabelas = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%uf%' OR table_name LIKE '%estado%' OR table_name LIKE '%legisl%')
      ORDER BY table_name
    `);
    console.log(tabelas.rows.map(r => r.table_name).join('\n'));

  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

verificarDetalhes();

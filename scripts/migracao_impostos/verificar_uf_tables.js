const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus';

async function verificarUFTables() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL\n');

    // Verificar tabela de signatários (deve ter UFs)
    console.log('=== Estrutura: cad_legislacao_signatario ===');
    const sigCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'cad_legislacao_signatario'
      ORDER BY ordinal_position
    `);
    console.table(sigCols.rows);

    console.log('\n=== Exemplo de dados: cad_legislacao_signatario ===');
    const sigData = await client.query(`
      SELECT * FROM db_manaus.cad_legislacao_signatario LIMIT 10
    `);
    console.log(JSON.stringify(sigData.rows, null, 2));

    // Verificar a view existente
    console.log('\n\n=== VIEW v_mva_ncm_uf (já existe?) ===');
    const viewExists = await client.query(`
      SELECT pg_get_viewdef('db_manaus.v_mva_ncm_uf', true) AS definition
    `);
    console.log(viewExists.rows[0]?.definition || 'VIEW não existe');

    // Verificar v_uf_icms_flags
    console.log('\n\n=== VIEW v_uf_icms_flags ===');
    const viewFlags = await client.query(`
      SELECT pg_get_viewdef('db_manaus.v_uf_icms_flags', true) AS definition
    `);
    console.log(viewFlags.rows[0]?.definition || 'VIEW não existe');

    // Verificar dbuf_n
    console.log('\n\n=== Estrutura: dbuf_n ===');
    const ufCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbuf_n'
      ORDER BY ordinal_position
    `);
    console.table(ufCols.rows);

    console.log('\n=== Dados: dbuf_n ===');
    const ufData = await client.query(`
      SELECT * FROM db_manaus.dbuf_n LIMIT 5
    `);
    console.log(JSON.stringify(ufData.rows, null, 2));

  } catch (err) {
    console.error('Erro:', err.message);
    console.error(err);
  } finally {
    await client.end();
  }
}

verificarUFTables();

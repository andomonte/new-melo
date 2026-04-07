const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus';

async function verificarEstruturas() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL');

    const tabelas = [
      'cad_legislacao_icmsst',
      'cad_legislacao_icmsst_ncm',
      'fis_tributo_aliquota',
      'dbcest'
    ];

    for (const tabela of tabelas) {
      console.log(`\n\n=== Estrutura da tabela: ${tabela} ===`);
      const result = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus' AND table_name = $1
        ORDER BY ordinal_position
      `, [tabela]);

      console.table(result.rows);

      // Verificar algumas linhas de exemplo
      console.log(`\n--- Exemplo de dados (3 primeiras linhas) ---`);
      const data = await client.query(`SELECT * FROM db_manaus.${tabela} LIMIT 3`);
      if (data.rows.length > 0) {
        console.log(JSON.stringify(data.rows, null, 2));
      } else {
        console.log('Tabela vazia');
      }
    }

  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

verificarEstruturas();

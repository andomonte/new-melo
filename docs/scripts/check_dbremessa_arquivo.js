const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
async function verificarTabela() {

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar se a tabela existe
    console.log('🔍 Verificando tabela dbremessa_arquivo:\n');
    const tabelaExiste = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbremessa_arquivo'
      ) as existe
    `);

    if (!tabelaExiste.rows[0].existe) {
      console.log('❌ Tabela dbremessa_arquivo NÃO EXISTE\n');
      
      // Procurar tabelas parecidas
      console.log('🔍 Procurando tabelas relacionadas a remessa:\n');
      const tabelasRemessa = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'db_manaus'
          AND table_name LIKE '%remessa%'
        ORDER BY table_name
      `);
      
      console.log('Tabelas encontradas:');
      tabelasRemessa.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('✅ Tabela dbremessa_arquivo EXISTE\n');
      
      // Mostrar estrutura
      console.log('📋 Estrutura da tabela:\n');
      const estrutura = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbremessa_arquivo'
        ORDER BY ordinal_position
      `);

      console.log('COLUNA                | TIPO            | TAMANHO | NULLABLE');
      console.log('----------------------|-----------------|---------|----------');
      estrutura.rows.forEach(row => {
        const col = (row.column_name || '').padEnd(21);
        const tipo = (row.data_type || '').padEnd(15);
        const tam = (row.character_maximum_length || '-').toString().padEnd(7);
        const nullable = row.is_nullable;
        console.log(`${col} | ${tipo} | ${tam} | ${nullable}`);
      });

      // Mostrar alguns dados
      console.log('\n📊 Sample de dados:\n');
      const dados = await client.query(`
        SELECT *
        FROM db_manaus.dbremessa_arquivo
        ORDER BY data_gerado DESC
        LIMIT 5
      `);

      if (dados.rows.length > 0) {
        console.log('Últimas 5 remessas geradas:');
        dados.rows.forEach(row => {
          console.log(row);
        });
      } else {
        console.log('⚠️ Tabela vazia');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n✅ Conexão fechada');
  }
}

verificarTabela();

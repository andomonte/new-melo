const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function buscarTabelaFormas() {
  const client = await pool.connect();
  
  try {
    // Buscar tabelas que possam ter cadastro de formas
    const tabelas = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'db_manaus')
        AND (table_name LIKE 'db%forma%' 
          OR table_name = 'dbconta'
          OR table_name LIKE '%fpag%')
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas:\n');
    
    for (const tabela of tabelas.rows) {
      console.log(`\n${tabela.table_schema}.${tabela.table_name}:`);
      
      // Ver estrutura
      const colunas = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        LIMIT 10
      `, [tabela.table_schema, tabela.table_name]);
      
      colunas.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      
      // Ver alguns dados
      const count = await client.query(`
        SELECT COUNT(*) FROM ${tabela.table_schema}.${tabela.table_name}
      `);
      
      console.log(`   Total: ${count.rows[0].count} registros`);
      
      if (parseInt(count.rows[0].count) > 0 && parseInt(count.rows[0].count) < 100) {
        const dados = await client.query(`
          SELECT * FROM ${tabela.table_schema}.${tabela.table_name}
          LIMIT 10
        `);
        
        console.log('   Dados:');
        dados.rows.forEach(r => {
          console.log('   ', JSON.stringify(r));
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

buscarTabelaFormas();

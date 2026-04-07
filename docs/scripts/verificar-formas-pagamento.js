const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verificarFormasPagamento() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando tabelas de formas de pagamento...\n');
    
    // Verificar se existe tabela de formas de pagamento
    const tabelas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%fpgto%'
        OR table_name LIKE '%forma%'
        OR table_name LIKE '%pagamento%'
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas relacionadas a pagamento encontradas:');
    tabelas.rows.forEach(t => console.log(`   - ${t.table_name}`));
    
    // Verificar db_manaus
    const tabelasManaus = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus' 
        AND (table_name LIKE '%fpgto%'
        OR table_name LIKE '%forma%'
        OR table_name LIKE '%pagamento%')
      ORDER BY table_name
    `);
    
    if (tabelasManaus.rows.length > 0) {
      console.log('\n📋 Tabelas em db_manaus:');
      tabelasManaus.rows.forEach(t => console.log(`   - ${t.table_name}`));
    }
    
    // Verificar valores únicos de cod_fpgto em dbfpgto
    console.log('\n💳 Formas de pagamento usadas (cod_fpgto):');
    const formasUsadas = await client.query(`
      SELECT DISTINCT cod_fpgto, COUNT(*) as qtd
      FROM db_manaus.dbfpgto
      WHERE cod_fpgto IS NOT NULL
      GROUP BY cod_fpgto
      ORDER BY cod_fpgto
    `);
    
    if (formasUsadas.rows.length > 0) {
      console.log('─'.repeat(40));
      formasUsadas.rows.forEach(f => {
        console.log(`   ${f.cod_fpgto}: ${f.qtd} pagamentos`);
      });
      console.log('─'.repeat(40));
    } else {
      console.log('   Nenhuma forma de pagamento registrada');
    }
    
    // Tentar encontrar tabela de cadastro de formas de pagamento
    const tabelasFpgto = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE (table_name = 'dbfpgto' OR table_name = 'fpgto' OR table_name = 'forma_pgto')
        AND table_type = 'BASE TABLE'
    `);
    
    if (tabelasFpgto.rows.length > 0) {
      console.log('\n📊 Possíveis tabelas de cadastro:');
      for (const tabela of tabelasFpgto.rows) {
        console.log(`\n   ${tabela.table_schema}.${tabela.table_name}:`);
        
        // Ver estrutura
        const colunas = await client.query(`
          SELECT column_name, data_type, character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [tabela.table_schema, tabela.table_name]);
        
        colunas.rows.forEach(col => {
          const tipo = col.character_maximum_length 
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type;
          console.log(`      - ${col.column_name}: ${tipo}`);
        });
        
        // Ver alguns registros se for tabela de cadastro (tem descricao/nome)
        const temDescricao = colunas.rows.some(c => 
          c.column_name.includes('descr') || 
          c.column_name.includes('nome') ||
          c.column_name === 'desc'
        );
        
        if (temDescricao) {
          const dados = await client.query(`
            SELECT * FROM ${tabela.table_schema}.${tabela.table_name}
            LIMIT 20
          `);
          
          if (dados.rows.length > 0) {
            console.log(`\n      Registros encontrados (${dados.rows.length}):`);
            dados.rows.forEach(r => {
              console.log('      ', JSON.stringify(r));
            });
          }
        }
      }
    }
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarFormasPagamento();

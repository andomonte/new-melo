const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function verificarEstrutura() {
  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar schemas disponíveis
    console.log('1. SCHEMAS DISPONÍVEIS:');
    console.log('========================\n');
    
    const schemas = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'db_%' OR schema_name = 'public'
      ORDER BY schema_name
    `);
    
    schemas.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });

    // Verificar tabelas em db_manaus
    console.log('\n2. TABELAS EM db_manaus:');
    console.log('=========================\n');
    
    const tabelas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%banco%' OR table_name LIKE '%conta%')
      ORDER BY table_name
    `);
    
    if (tabelas.rows.length > 0) {
      tabelas.rows.forEach(row => {
        console.log(`  ✓ db_manaus.${row.table_name}`);
      });
    } else {
      console.log('  ⚠️  Nenhuma tabela encontrada');
    }

    // Tentar consultar dbbanco diretamente
    console.log('\n3. TESTANDO CONSULTA DIRETA:');
    console.log('==============================\n');
    
    try {
      const testQuery = await client.query(`
        SELECT cod_banco, nome, cod_bc 
        FROM db_manaus.dbbanco 
        LIMIT 5
      `);
      
      console.log(`  ✓ Sucesso! ${testQuery.rows.length} registros encontrados:\n`);
      testQuery.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.cod_banco} - ${row.nome} (BC: ${row.cod_bc})`);
      });
    } catch (err) {
      console.log(`  ✗ Erro: ${err.message}`);
      
      // Tentar sem schema
      console.log('\n  Tentando sem schema (apenas dbbanco)...\n');
      try {
        const testQuery2 = await client.query(`
          SELECT cod_banco, nome, cod_bc 
          FROM dbbanco 
          LIMIT 5
        `);
        
        console.log(`  ✓ Sucesso! ${testQuery2.rows.length} registros encontrados:\n`);
        testQuery2.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.cod_banco} - ${row.nome} (BC: ${row.cod_bc})`);
        });
      } catch (err2) {
        console.log(`  ✗ Erro: ${err2.message}`);
      }
    }

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verificarEstrutura();

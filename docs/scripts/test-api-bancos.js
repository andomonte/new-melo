const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testarApiBancos() {
  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    console.log(`   URL: ${process.env.DATABASE_URL?.split('@')[1] || 'local'}\n`);

    console.log('==========================================');
    console.log('TESTE: API DE BANCOS - CONTAS A PAGAR');
    console.log('==========================================\n');

    // Primeiro, verificar se as tabelas existem
    console.log('1. Verificando tabelas...\n');
    
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'db_manaus' 
        AND table_name IN ('dbbanco', 'dbconta')
    `);
    
    console.log('Tabelas encontradas:');
    checkTables.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Query que será usada na API
    console.log('\n2. Buscando bancos cadastrados...\n');
    
    const query = `
      SELECT 
        cod_banco,
        nome,
        cod_bc
      FROM db_manaus.dbbanco
      ORDER BY nome
    `;

    const result = await client.query(query);

    console.log(`Total de bancos encontrados: ${result.rows.length}\n`);

    // Simular transformação da API
    const bancos = result.rows.map((row) => {
      const codBanco = row.cod_banco?.toString().trim();
      const nome = row.nome?.trim() || 'Sem nome';
      const codBc = row.cod_bc?.toString().trim() || '';
      
      // Formatar label: "COD_BC - NOME" se tiver cod_bc, senão "COD_BANCO - NOME"
      const label = codBc && codBc !== '0' && codBc !== '000'
        ? `${codBc} - ${nome}`
        : `${codBanco} - ${nome}`;

      return {
        value: codBanco,
        label: label,
      };
    });

    console.log('BANCOS RETORNADOS PELA API:');
    console.log('----------------------------\n');
    
    bancos.forEach((banco, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${banco.label}`);
      console.log(`    Value: ${banco.value}`);
    });

    console.log('\n==========================================');
    console.log('PREVIEW DO JSON DA API:');
    console.log('==========================================\n');
    console.log(JSON.stringify(bancos.slice(0, 5), null, 2));

    console.log('\n✅ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testarApiBancos();

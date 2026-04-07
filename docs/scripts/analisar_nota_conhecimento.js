const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function analisarNotasConhecimento() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analisando estrutura das tabelas de Nota de Conhecimento...\n');
    
    // 1. Verificar dbconhecimento
    console.log('📋 Tabela: dbconhecimento');
    const colunasConhecimento = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbconhecimento'
      ORDER BY ordinal_position
    `);
    
    if (colunasConhecimento.rows.length > 0) {
      console.log('Colunas:');
      colunasConhecimento.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}) ${col.is_nullable === 'NO' ? '* obrigatório' : ''}`);
      });
      
      // Buscar alguns registros de exemplo
      const exemplos = await client.query('SELECT * FROM db_manaus.dbconhecimento LIMIT 3');
      console.log(`\nTotal de registros: ${exemplos.rows.length > 0 ? 'Tem dados' : 'Vazio'}`);
      if (exemplos.rows.length > 0) {
        console.log('Exemplo de registro:', JSON.stringify(exemplos.rows[0], null, 2));
      }
    } else {
      console.log('❌ Tabela não existe ou está vazia');
    }
    
    // 2. Verificar dbconhecimentoent
    console.log('\n📋 Tabela: dbconhecimentoent');
    const colunasConhecimentoEnt = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbconhecimentoent'
      ORDER BY ordinal_position
    `);
    
    if (colunasConhecimentoEnt.rows.length > 0) {
      console.log('Colunas:');
      colunasConhecimentoEnt.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}) ${col.is_nullable === 'NO' ? '* obrigatório' : ''}`);
      });
      
      const exemplos = await client.query('SELECT * FROM db_manaus.dbconhecimentoent LIMIT 3');
      console.log(`\nTotal de registros: ${exemplos.rows.length > 0 ? 'Tem dados' : 'Vazio'}`);
      if (exemplos.rows.length > 0) {
        console.log('Exemplo de registro:', JSON.stringify(exemplos.rows[0], null, 2));
      }
    } else {
      console.log('❌ Tabela não existe ou está vazia');
    }
    
    // 3. Verificar relacionamento com dbpgto
    console.log('\n🔗 Analisando relacionamento com dbpgto...');
    const relacionamento = await client.query(`
      SELECT 
        c.column_name,
        c.data_type,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
        AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE c.table_schema = 'db_manaus' 
        AND c.table_name IN ('dbconhecimento', 'dbconhecimentoent')
        AND (c.column_name LIKE '%pgto%' OR c.column_name LIKE '%cod%')
      ORDER BY c.table_name, c.ordinal_position
    `);
    
    console.log('Colunas de relacionamento:');
    relacionamento.rows.forEach(row => {
      console.log(`  - ${row.column_name} em ${row.table_name}`);
    });
    
    // 4. Buscar chaves de relacionamento comuns
    console.log('\n🔑 Buscando possíveis chaves de relacionamento...');
    const chaves = await client.query(`
      SELECT DISTINCT column_name
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name IN ('dbconhecimento', 'dbconhecimentoent', 'dbpgto')
        AND column_name LIKE 'cod_%'
      ORDER BY column_name
    `);
    
    console.log('Colunas comuns (possíveis chaves):');
    chaves.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

analisarNotasConhecimento();

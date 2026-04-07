import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function verificarEstrutura() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('🔍 Verificando estrutura da tabela dbpgto...\n');
    
    // Buscar todas as colunas da tabela
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'dbpgto'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Colunas da tabela dbpgto:');
    console.log('='.repeat(80));
    
    result.rows.forEach(col => {
      console.log(`\n📌 ${col.column_name}`);
      console.log(`   Tipo: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`   Nulo: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total de colunas: ${result.rows.length}`);
    
    // Gerar INSERT statement exemplo
    console.log('\n\n📝 INSERT Statement sugerido:\n');
    const colunas = result.rows
      .filter(col => col.column_default === null || !col.column_default.includes('nextval'))
      .map(col => col.column_name);
    
    console.log('INSERT INTO dbpgto (');
    console.log('  ' + colunas.join(',\n  '));
    console.log(') VALUES (');
    console.log('  ' + colunas.map((_, i) => `$${i + 1}`).join(',\n  '));
    console.log(')');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarEstrutura();

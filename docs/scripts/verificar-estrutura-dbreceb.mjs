import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function verificarEstrutura() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('🔍 Verificando estrutura da tabela dbreceb...\n');
    
    // Buscar todas as colunas da tabela
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbreceb'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Colunas da tabela db_manaus.dbreceb:');
    console.log('='.repeat(80));
    
    result.rows.forEach(col => {
      console.log(`\n📌 ${col.column_name}`);
      console.log(`   Tipo: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`   Nulo: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total de colunas: ${result.rows.length}`);
    
    // Verificar se a coluna 'obs' existe
    const temObs = result.rows.some(col => col.column_name === 'obs');
    console.log(`\n🔎 Coluna 'obs' existe? ${temObs ? 'SIM ✅' : 'NÃO ❌'}`);
    
    if (!temObs) {
      console.log('\n⚠️  A coluna "obs" NÃO existe na tabela dbreceb!');
      console.log('   Isso está causando o erro no endpoint /api/contas-receber/criar');
      
      // Verificar colunas similares
      const colunasTexto = result.rows.filter(col => 
        col.data_type.includes('character') || col.data_type.includes('text')
      );
      console.log('\n📋 Colunas de texto disponíveis na tabela:');
      colunasTexto.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      });
    }
    
    // Listar todas as colunas para referência
    console.log('\n\n📝 Lista completa de colunas:');
    const colunas = result.rows.map(col => col.column_name);
    console.log(colunas.join(', '));
    
    // Gerar INSERT statement sugerido (sem a coluna obs)
    console.log('\n\n📝 INSERT Statement sugerido (sem coluna obs):\n');
    const colunasInsert = result.rows
      .filter(col => col.column_default === null || !col.column_default.includes('nextval'))
      .map(col => col.column_name);
    
    console.log('INSERT INTO db_manaus.dbreceb (');
    console.log('  ' + colunasInsert.join(',\n  '));
    console.log(') VALUES (');
    console.log('  ' + colunasInsert.map((_, i) => `$${i + 1}`).join(',\n  '));
    console.log(')');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarEstrutura();

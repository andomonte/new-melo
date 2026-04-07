import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verificarColunas() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('='.repeat(80));
    console.log('CONSULTANDO COLUNAS DA TABELA DBFRECEB');
    console.log('='.repeat(80));
    console.log('\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfreceb'
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Tabela db_manaus.dbfreceb não encontrada ou sem colunas!');
      process.exit(1);
    }
    
    console.log('Colunas da tabela db_manaus.dbfreceb:');
    console.log('-'.repeat(80));
    
    result.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${col.column_name.padEnd(30)} ${(col.data_type + length).padEnd(20)} ${nullable}${defaultVal}`);
    });
    
    console.log('\n');
    console.log('Total de colunas:', result.rows.length);
    console.log('='.repeat(80));
    
    // Verificar se existe cof_id
    const temCofId = result.rows.some(r => r.column_name === 'cof_id');
    const temFreCofId = result.rows.some(r => r.column_name === 'fre_cof_id');
    const temRecCofId = result.rows.some(r => r.column_name === 'rec_cof_id');
    
    console.log('\nVerificação de colunas de conta financeira:');
    console.log(`  cof_id: ${temCofId ? '✓ EXISTE' : '✗ NÃO EXISTE'}`);
    console.log(`  fre_cof_id: ${temFreCofId ? '✓ EXISTE' : '✗ NÃO EXISTE'}`);
    console.log(`  rec_cof_id: ${temRecCofId ? '✓ EXISTE' : '✗ NÃO EXISTE'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao consultar estrutura:', error);
    console.error('Detalhes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verificarColunas();

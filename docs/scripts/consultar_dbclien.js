import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function consultarEstrutura() {
  const pool = new pg.Pool({
connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('Consultando estrutura da tabela dbclien...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbclien'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas da tabela db_manaus.dbclien:');
    console.log('=====================================\n');
    
    result.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`${col.column_name.padEnd(30)} ${col.data_type}${length}`);
    });
    
    console.log('\n\nTotal de colunas:', result.rows.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Erro ao consultar estrutura:', error);
    process.exit(1);
  }
}

consultarEstrutura();

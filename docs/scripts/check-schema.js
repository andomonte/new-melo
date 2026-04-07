import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();    

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  try {
    // Tabela remessa (a tabela que o usuário quer entender)
    console.log('=== TABELA: remessa ===');
    const result0 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'remessa'
      ORDER BY ordinal_position
    `);
    
    if (result0.rows.length === 0) {
      console.log('Tabela remessa nao encontrada');
    } else {
      console.log('Colunas:');
      result0.rows.forEach(c => console.log('  - ' + c.column_name + ': ' + c.data_type));
    }

    // Verificar alguns dados de exemplo
    try {
      const result0b = await pool.query(`SELECT * FROM db_manaus.remessa LIMIT 3`);
      console.log('\nDados exemplo (' + result0b.rows.length + ' registros):');
      if (result0b.rows.length > 0) {
        console.log(JSON.stringify(result0b.rows[0], null, 2));
      }
    } catch (err) {
      console.log('Erro ao buscar dados:', err.message);
    }

    // Tabela dbremessa_arquivo (para comparar)
    console.log('\n=== TABELA: dbremessa_arquivo ===');
    const result1 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbremessa_arquivo'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas:');
    result1.rows.forEach(c => console.log('  - ' + c.column_name + ': ' + c.data_type));

    // Tabela dbremessa_detalhe
    console.log('\n=== TABELA: dbremessa_detalhe ===');
    const result2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
      AND table_name = 'dbremessa_detalhe'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas:');
    result2.rows.forEach(c => console.log('  - ' + c.column_name + ': ' + c.data_type));

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function adicionarColunaSerie() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adicionando coluna serie na tabela dbfat_nfe...\n');
    
    const sqlPath = path.join(__dirname, 'adicionar-coluna-serie-nfe.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Coluna serie adicionada com sucesso!\n');
    
    // Verificar a estrutura
    const colunas = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfat_nfe' 
        AND column_name IN ('nrodoc_fiscal', 'serie')
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura das colunas:');
    console.table(colunas.rows);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

adicionarColunaSerie();

require('dotenv').config();
const { Pool } = require('pg');

async function verificarFaturasAgrupadas() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const client = await pool.connect();
    
    console.log('🔍 Verificando as 3 faturas agrupadas...\n');
    
    const query = `
      SELECT 
        f.codfat,
        f.nroform,
        f.nfs,
        f.codgp,
        f.agp,
        c.nome AS cliente_nome,
        CASE WHEN c.nome IS NOT NULL AND c.nome <> '' THEN 'OK' ELSE 'PROBLEMA' END as cliente_check,
        CASE WHEN f.nroform IS NOT NULL AND f.nroform <> '' THEN 'OK' ELSE 'PROBLEMA' END as nroform_check
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      WHERE f.codgp IS NOT NULL
      ORDER BY f.codgp, f.data DESC;
    `;
    
    const result = await client.query(query);
    console.log('Faturas agrupadas encontradas:');
    console.table(result.rows);
    
    // Testar a condição exata da API
    console.log('\n🔍 Testando condição exata da API:');
    const apiQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      WHERE (c.nome IS NOT NULL AND c.nome <> '' AND f.nroform IS NOT NULL AND f.nroform <> '') 
      AND (f.nfs = $1) 
      AND f.codgp IS NOT NULL;
    `;
    
    const apiResult = await client.query(apiQuery, ['S']);
    console.log(`Total encontrado com condições da API: ${apiResult.rows[0].total}`);
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarFaturasAgrupadas();

// Consultar exemplos de registros na tabela dbreceb
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function consultarExemplos() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Consultando exemplos de registros em dbreceb...\n');

    const query = `
      SELECT 
        cod_receb, 
        nro_docbanco, 
        nro_banco, 
        banco, 
        bradesco,
        forma_fat,
        valor_pgto
      FROM db_manaus.dbreceb 
      WHERE nro_banco IS NOT NULL 
      LIMIT 10;
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum registro encontrado com nro_banco preenchido');
    } else {
      console.log(`✅ Encontrados ${result.rows.length} registros:\n`);
      
      result.rows.forEach((row, idx) => {
        console.log(`📄 Registro ${idx + 1}:`);
        console.log(`   cod_receb:     ${row.cod_receb}`);
        console.log(`   nro_docbanco:  ${row.nro_docbanco}`);
        console.log(`   nro_banco:     ${row.nro_banco}`);
        console.log(`   banco:         ${row.banco}`);
        console.log(`   bradesco:      ${row.bradesco}`);
        console.log(`   forma_fat:     ${row.forma_fat}`);
        console.log(`   valor_pgto:    ${row.valor_pgto}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

consultarExemplos();

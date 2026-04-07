const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarDbcredor() {
  try {
    console.log('=== Consultando estrutura da tabela DBCREDOR ===\n');
    
    // Consultar colunas da tabela dbcredor
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbcredor' 
      ORDER BY ordinal_position
    `);

    console.log(`Total de colunas: ${result.rows.length}\n`);
    
    result.rows.forEach((col, index) => {
      const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`${index + 1}. ${col.column_name.padEnd(30)} ${col.data_type}${maxLength.padEnd(10)} ${nullable}`);
    });

    console.log('\n=== Verificando campo CODPAIS para identificar internacionais ===\n');
    
    // Verificar fornecedores com codpais preenchido (internacionais)
    const fornecedoresInternacionais = await pool.query(`
      SELECT cod_credor, nome, codpais, uf, cidade
      FROM db_manaus.dbcredor
      WHERE codpais IS NOT NULL AND codpais != 1058
      LIMIT 20
    `);
    
    console.log(`✅ Fornecedores internacionais encontrados (codpais != 1058/Brasil): ${fornecedoresInternacionais.rows.length}`);
    if (fornecedoresInternacionais.rows.length > 0) {
      fornecedoresInternacionais.rows.forEach(f => {
        console.log(`  - ${f.cod_credor} | ${f.nome} | País: ${f.codpais} | UF: ${f.uf} | Cidade: ${f.cidade}`);
      });
    }

    console.log('\n=== Verificando distribuição de codpais ===\n');
    const distribuicao = await pool.query(`
      SELECT codpais, COUNT(*) as total
      FROM db_manaus.dbcredor
      GROUP BY codpais
      ORDER BY total DESC
      LIMIT 10
    `);
    
    distribuicao.rows.forEach(d => {
      const pais = d.codpais === 1058 ? '(Brasil)' : d.codpais === null ? '(NULL)' : '';
      console.log(`  País ${d.codpais || 'NULL'} ${pais}: ${d.total} fornecedores`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

consultarDbcredor();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarContaFinanceira() {
  try {
    console.log('=== Consultando estrutura da tabela CAD_CONTA_FINANCEIRA ===\n');
    
    // Consultar colunas da tabela
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'cad_conta_financeira' 
      ORDER BY ordinal_position
    `);

    console.log(`Total de colunas: ${result.rows.length}\n`);
    
    result.rows.forEach((col, index) => {
      const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`${index + 1}. ${col.column_name.padEnd(30)} ${col.data_type}${maxLength.padEnd(10)} ${nullable}`);
    });

    console.log('\n=== Verificando contas financeiras (amostra) ===\n');
    
    // Buscar algumas contas financeiras
    const contas = await pool.query(`
      SELECT cof_id, cof_descricao, cof_cec_id
      FROM db_manaus.cad_conta_financeira
      ORDER BY cof_id
    `);
    
    console.log(`Total de contas: ${contas.rows.length}\n`);
    
    // Buscar contas que parecem internacionais
    const contasInternacionais = contas.rows.filter(c => 
      c.cof_descricao.toUpperCase().includes('USD') ||
      c.cof_descricao.toUpperCase().includes('DOLAR') ||
      c.cof_descricao.toUpperCase().includes('INTERNACIONAL') ||
      c.cof_descricao.toUpperCase().includes('EXTERIOR') ||
      c.cof_descricao.toUpperCase().includes('IMPORT')
    );
    
    if (contasInternacionais.length > 0) {
      console.log(`✅ Contas com padrão internacional: ${contasInternacionais.length}\n`);
      contasInternacionais.forEach(c => {
        console.log(`  - ID: ${c.cof_id} | ${c.cof_descricao}`);
      });
    } else {
      console.log('⚠️  Nenhuma conta com padrão internacional encontrada');
    }
    
    console.log('\n=== Primeiras 30 contas ===\n');
    contas.rows.slice(0, 30).forEach(c => {
      console.log(`  - ID: ${c.cof_id} | ${c.cof_descricao}`);
    });

    console.log('\n=== Buscando campo que indique internacional ===\n');
    
    const colunaInternacional = result.rows.find(col => 
      col.column_name.toLowerCase().includes('internacional') ||
      col.column_name.toLowerCase().includes('moeda') ||
      col.column_name.toLowerCase().includes('currency') ||
      col.column_name.toLowerCase().includes('exterior')
    );

    if (colunaInternacional) {
      console.log(`✅ Campo encontrado: ${colunaInternacional.column_name}`);
    } else {
      console.log('⚠️  Nenhum campo específico para internacional encontrado na tabela');
      console.log('💡 Sugestão: Usar convenção de nomenclatura na descrição (ex: contas com "USD", "EUR", "INTERNACIONAL" no nome)');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

consultarContaFinanceira();

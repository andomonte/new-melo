const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/db_manaus'
});

async function verificarEstrutura() {
  try {
    console.log('🔍 Verificando estrutura da tabela dbfpgto...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbfpgto'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colunas encontradas:');
    console.log('─'.repeat(80));
    result.rows.forEach((col, index) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`${index + 1}. ${col.column_name.padEnd(25)} - ${col.data_type}${length}`);
    });
    console.log('─'.repeat(80));
    console.log(`\n✅ Total de colunas: ${result.rows.length}\n`);

    // Verificar se existe campo seq ou similar
    const temSeq = result.rows.find(col => col.column_name.toLowerCase().includes('seq'));
    const temId = result.rows.find(col => col.column_name.toLowerCase().includes('id'));
    
    console.log('🔑 Possíveis chaves primárias/identificadores:');
    if (temSeq) console.log(`   ✓ Encontrado: ${temSeq.column_name}`);
    if (temId) console.log(`   ✓ Encontrado: ${temId.column_name}`);
    
    // Buscar constraints de chave primária
    const pkResult = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'db_manaus.dbfpgto'::regclass AND i.indisprimary;
    `);

    if (pkResult.rows.length > 0) {
      console.log('\n🔐 Chave(s) primária(s) da tabela:');
      pkResult.rows.forEach(row => {
        console.log(`   ✓ ${row.attname}`);
      });
    } else {
      console.log('\n⚠️  Nenhuma chave primária definida');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarEstrutura();

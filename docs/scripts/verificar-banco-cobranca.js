
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();



async function verificarBancoCobranca() {

    const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  VERIFICANDO dbbanco_cobranca');
    console.log('════════════════════════════════════════════════════════\n');

    // Estrutura da tabela
    const estrutura = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbbanco_cobranca'
      ORDER BY ordinal_position;
    `);

    console.log('📋 ESTRUTURA DA TABELA:\n');
    console.log('   COLUNA                    TIPO                 NULLABLE');
    console.log('   ───────────────────────── ──────────────────── ────────');
    estrutura.rows.forEach(col => {
      const tamanho = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`   ${col.column_name.padEnd(25)} ${(col.data_type + tamanho).padEnd(20)} ${nullable}`);
    });

    // Dados da tabela
    const dados = await pool.query(`
      SELECT * FROM db_manaus.dbbanco_cobranca
      LIMIT 20;
    `);

    console.log('\n────────────────────────────────────────────────────────');
    console.log(`📊 DADOS DA TABELA (${dados.rows.length} registros):\n`);

    dados.rows.forEach((row, idx) => {
      console.log(`   ┌─ Registro ${idx + 1}`);
      Object.entries(row).forEach(([key, value]) => {
        const displayValue = value === null ? '(null)' : value;
        console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
      });
      console.log('   └─\n');
    });

    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Verificação concluída!');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

verificarBancoCobranca();

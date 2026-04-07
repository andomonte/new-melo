const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarDbConta() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🔍  VERIFICAÇÃO DA TABELA dbconta');
    console.log('════════════════════════════════════════════════════════\n');

    // Verificar se a tabela existe
    const tabelaExiste = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbconta'
      );
    `);

    if (!tabelaExiste.rows[0].exists) {
      console.log('❌ Tabela dbconta NÃO encontrada no schema db_manaus\n');
      return;
    }

    console.log('✅ Tabela dbconta encontrada!\n');

    // Listar colunas da tabela
    const colunas = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbconta'
      ORDER BY ordinal_position;
    `);

    console.log('────────────────────────────────────────────────────────');
    console.log('📋 ESTRUTURA DA TABELA');
    console.log('────────────────────────────────────────────────────────\n');
    console.log('   COLUNA                    TIPO                 NULLABLE');
    console.log('   ───────────────────────── ──────────────────── ────────');

    colunas.rows.forEach((col) => {
      const tamanho = col.character_maximum_length
        ? `(${col.character_maximum_length})`
        : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(
        `   ${col.column_name.padEnd(25)} ${(col.data_type + tamanho).padEnd(
          20,
        )} ${nullable}`,
      );
    });

    // Contar total de registros
    const count = await pool.query(`
      SELECT COUNT(*) as total FROM db_manaus.dbconta;
    `);

    console.log('\n────────────────────────────────────────────────────────');
    console.log('📊 DADOS DA TABELA');
    console.log('────────────────────────────────────────────────────────\n');
    console.log(`   Total de registros: ${count.rows[0].total}\n`);

    // Buscar alguns exemplos de dados
    const exemplos = await pool.query(`
      SELECT * FROM db_manaus.dbconta
      LIMIT 10;
    `);

    if (exemplos.rows.length === 0) {
      console.log('   ⚠️  Nenhum registro encontrado na tabela\n');
    } else {
      console.log(
        `   Mostrando ${exemplos.rows.length} primeiros registros:\n`,
      );

      exemplos.rows.forEach((row, idx) => {
        console.log(`   ┌─ Registro ${idx + 1}`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === null ? '(null)' : value;
          console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
        });
        console.log('   └─');
      });
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ Verificação concluída!');
    console.log('════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO AO VERIFICAR dbconta');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.error('\nDetalhes completos:');
    console.error(error);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

verificarDbConta();

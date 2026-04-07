const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/db_manaus'
});

async function verificarContaFinanceira() {
  try {
    console.log('🔍 Verificando estrutura das tabelas de contas financeiras...\n');

    const tabelas = ['cad_conta_financeira', 'cad_grupo__centro_custo', 'cad_centro_custo'];

    for (const tabela of tabelas) {
      console.log(`📋 Tabela: ${tabela}`);
      console.log('─'.repeat(80));
      
      const result = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tabela]);

      if (result.rows.length > 0) {
        result.rows.forEach((col, index) => {
          const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          console.log(`  ${(index + 1).toString().padStart(2)}. ${col.column_name.padEnd(30)} - ${col.data_type}${length}`);
        });
      } else {
        console.log('  ⚠️  Tabela não encontrada ou sem colunas');
      }
      
      console.log('─'.repeat(80) + '\n');
    }

    // Verificar foreign keys
    console.log('🔗 Verificando relacionamentos (Foreign Keys):\n');
    
    const fkQuery = `
      SELECT
        tc.table_name as tabela_origem,
        kcu.column_name as coluna_origem,
        ccu.table_name as tabela_destino,
        ccu.column_name as coluna_destino
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'db_manaus'
        AND (tc.table_name IN ('cad_conta_financeira', 'cad_grupo__centro_custo', 'cad_centro_custo')
          OR ccu.table_name IN ('cad_conta_financeira', 'cad_grupo__centro_custo', 'cad_centro_custo'))
      ORDER BY tc.table_name;
    `;

    const fkResult = await pool.query(fkQuery);

    if (fkResult.rows.length > 0) {
      console.log('─'.repeat(80));
      fkResult.rows.forEach((fk, index) => {
        console.log(`${index + 1}. ${fk.tabela_origem}.${fk.coluna_origem} → ${fk.tabela_destino}.${fk.coluna_destino}`);
      });
      console.log('─'.repeat(80));
    } else {
      console.log('⚠️  Nenhum relacionamento encontrado');
    }

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarContaFinanceira();

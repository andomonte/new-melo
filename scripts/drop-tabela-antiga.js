/**
 * Script para deletar a tabela DBFORMACAOPRVENDA antiga (maiúscula)
 * Mantém apenas a versão minúscula que é a correta
 */

const { Pool } = require('pg');

async function deletarTabelaAntiga() {
  const pool = new Pool({
    host: '192.168.100.1',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Melo2025',
  });

  try {
    console.log('🔍 Verificando se tabela DBFORMACAOPRVENDA (maiúscula) existe...');

    // Verificar se existe
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND table_name = 'DBFORMACAOPRVENDA'
    `);

    const exists = parseInt(checkResult.rows[0].count) > 0;

    if (!exists) {
      console.log('✅ Tabela DBFORMACAOPRVENDA (maiúscula) não existe. Nada a fazer.');
      return;
    }

    console.log('📊 Verificando quantos registros existem...');
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM db_manaus."DBFORMACAOPRVENDA"
    `);

    console.log(`   Encontrados ${countResult.rows[0].count} registros`);

    console.log('🗑️  Deletando tabela DBFORMACAOPRVENDA (maiúscula)...');
    await pool.query('DROP TABLE IF EXISTS db_manaus."DBFORMACAOPRVENDA" CASCADE');

    console.log('✅ Tabela deletada com sucesso!');
    console.log('');
    console.log('📝 Nota: A tabela db_manaus.dbformacaoprvenda (minúscula) foi mantida.');

  } catch (error) {
    console.error('❌ Erro ao deletar tabela:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

deletarTabelaAntiga();

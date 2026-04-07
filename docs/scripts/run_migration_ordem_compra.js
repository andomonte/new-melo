require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function runMigration() {
  try {
    console.log('🔄 Iniciando migration: Adicionar coluna ordem_compra...\n');

    // 1. Adicionar coluna
    console.log('1️⃣ Adicionando coluna ordem_compra...');
    await pool.query(`
      ALTER TABLE db_manaus.dbpgto 
      ADD COLUMN IF NOT EXISTS ordem_compra VARCHAR(50)
    `);
    console.log('✅ Coluna adicionada com sucesso!\n');

    // 2. Migrar dados
    console.log('2️⃣ Migrando dados do campo obs...');
    const updateResult = await pool.query(`
      UPDATE db_manaus.dbpgto
      SET ordem_compra = TRIM(SUBSTRING(obs FROM '#([0-9]+)'))
      WHERE obs LIKE '%Ordem de Compra #%'
        AND (ordem_compra IS NULL OR ordem_compra = '')
    `);
    console.log(`✅ ${updateResult.rowCount} registros atualizados!\n`);

    // 3. Verificar resultados
    console.log('3️⃣ Verificando resultados...');
    const verifyResult = await pool.query(`
      SELECT 
        cod_pgto,
        obs,
        ordem_compra,
        CASE 
          WHEN ordem_compra IS NOT NULL THEN 'Migrado'
          WHEN obs LIKE '%Ordem de Compra #%' THEN 'Padrão não encontrado'
          ELSE 'Sem ordem de compra'
        END as status_migracao
      FROM db_manaus.dbpgto
      WHERE obs LIKE '%Ordem de Compra #%'
      ORDER BY cod_pgto DESC
      LIMIT 10
    `);
    
    console.log('\nExemplos de registros migrados:');
    console.table(verifyResult.rows);

    // 4. Estatísticas
    console.log('\n4️⃣ Estatísticas da migração:');
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(ordem_compra) as com_ordem_compra,
        COUNT(*) - COUNT(ordem_compra) as sem_ordem_compra,
        COUNT(CASE WHEN obs LIKE '%Ordem de Compra #%' THEN 1 END) as obs_com_padrao
      FROM db_manaus.dbpgto
    `);
    
    console.table(statsResult.rows);

    console.log('\n✅ Migration concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

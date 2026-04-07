require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function verificarColunas() {
  try {
    console.log('🔍 Verificando estrutura das tabelas...\n');

    // 1. Colunas da tabela dbreceb
    console.log('📊 TABELA: db_manaus.dbreceb (Contas a Receber)');
    console.log('='.repeat(80));
    const colunasReceb = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbreceb'
      ORDER BY ordinal_position
    `);
    
    console.table(colunasReceb.rows);
    console.log(`\n✅ Total de colunas: ${colunasReceb.rows.length}\n`);

    // 2. Colunas da tabela dbclien
    console.log('📊 TABELA: db_manaus.dbclien (Clientes)');
    console.log('='.repeat(80));
    const colunasClien = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbclien'
      ORDER BY ordinal_position
    `);
    
    console.table(colunasClien.rows);
    console.log(`\n✅ Total de colunas: ${colunasClien.rows.length}\n`);

    // 3. Exemplo de dados da dbreceb (primeira linha)
    console.log('📄 EXEMPLO DE DADOS - dbreceb (primeira linha):');
    console.log('='.repeat(80));
    const exemploReceb = await pool.query(`
      SELECT *
      FROM db_manaus.dbreceb
      LIMIT 1
    `);
    
    if (exemploReceb.rows.length > 0) {
      console.log('\nColunas encontradas:');
      console.log(Object.keys(exemploReceb.rows[0]).join(', '));
      console.log('\nDados:');
      console.log(exemploReceb.rows[0]);
    } else {
      console.log('⚠️ Tabela vazia');
    }

    // 4. Exemplo de dados da dbclien (primeira linha)
    console.log('\n📄 EXEMPLO DE DADOS - dbclien (primeira linha):');
    console.log('='.repeat(80));
    const exemploClien = await pool.query(`
      SELECT *
      FROM db_manaus.dbclien
      LIMIT 1
    `);
    
    if (exemploClien.rows.length > 0) {
      console.log('\nColunas encontradas:');
      console.log(Object.keys(exemploClien.rows[0]).join(', '));
      console.log('\nDados:');
      console.log(exemploClien.rows[0]);
    } else {
      console.log('⚠️ Tabela vazia');
    }

    // 5. Verificar se existe tabela dbfreceb (histórico)
    console.log('\n📊 TABELA: db_manaus.dbfreceb (Histórico de Recebimentos)');
    console.log('='.repeat(80));
    const colunasFreceb = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfreceb'
      ORDER BY ordinal_position
    `);
    
    if (colunasFreceb.rows.length > 0) {
      console.table(colunasFreceb.rows);
      console.log(`\n✅ Total de colunas: ${colunasFreceb.rows.length}\n`);
    } else {
      console.log('⚠️ Tabela não encontrada\n');
    }

    // 6. Listar todas as tabelas que começam com 'db' no schema
    console.log('📋 TODAS AS TABELAS no schema db_manaus:');
    console.log('='.repeat(80));
    const todasTabelas = await pool.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND table_name LIKE 'db%'
      ORDER BY table_name
    `);
    
    console.log(`\n✅ Total de tabelas encontradas: ${todasTabelas.rows.length}\n`);
    console.log('Tabelas:');
    todasTabelas.rows.forEach(t => {
      console.log(`  - ${t.table_name} (${t.table_type})`);
    });

    console.log('\n✅ Verificação concluída!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro ao verificar colunas:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verificarColunas();

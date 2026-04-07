
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function buscarDadosCompletos() {
      const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  BUSCANDO DADOS COMPLETOS DAS CONTAS BB');
    console.log('════════════════════════════════════════════════════════\n');

    // Verificar se existe coluna de agência em dbconta
    const colunas = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbconta';
    `);

    console.log('📋 Colunas disponíveis em dbconta:\n');
    colunas.rows.forEach(col => {
      console.log(`   - ${col.column_name}`);
    });

    // Buscar todos os dados das contas BB principais
    const contasBB = await pool.query(`
      SELECT *
      FROM db_manaus.dbconta
      WHERE cod_banco = '0001'
      AND cod_conta IN ('0010', '0211', '0207')
      ORDER BY cod_conta;
    `);

    console.log('\n────────────────────────────────────────────────────────');
    console.log('💼 DADOS COMPLETOS DAS CONTAS PRINCIPAIS BB:');
    console.log('────────────────────────────────────────────────────────\n');

    contasBB.rows.forEach((conta) => {
      console.log(`   ┌─ Conta ${conta.cod_conta} - ${conta.nro_conta}`);
      Object.entries(conta).forEach(([key, value]) => {
        const displayValue = value === null ? '(null)' : value;
        console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
      });
      console.log('   └─\n');
    });

    // Buscar tabelas que possam ter informações de agência
    console.log('────────────────────────────────────────────────────────');
    console.log('🔍 Procurando tabelas com informações bancárias...\n');

    const tabelas = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
      AND (
        table_name LIKE '%banco%'
        OR table_name LIKE '%agencia%'
        OR table_name LIKE '%conta%'
      )
      ORDER BY table_name;
    `);

    console.log('   Tabelas encontradas:\n');
    tabelas.rows.forEach(t => {
      console.log(`   - ${t.table_name}`);
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ Busca concluída!');
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

buscarDadosCompletos();

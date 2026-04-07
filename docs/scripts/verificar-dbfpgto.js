const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verificarDBFPGTO() {
  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    console.log('==========================================');
    console.log('ESTRUTURA DA TABELA DBFPGTO');
    console.log('==========================================\n');

    // Verificar estrutura da tabela
    const estrutura = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfpgto'
      ORDER BY ordinal_position
    `);

    console.log('Colunas da DBFPGTO:\n');
    estrutura.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  - ${col.column_name.padEnd(20)} ${col.data_type}${length.padEnd(10)} ${nullable}`);
    });

    // Verificar alguns registros de exemplo
    console.log('\n==========================================');
    console.log('EXEMPLOS DE REGISTROS:');
    console.log('==========================================\n');

    const exemplos = await client.query(`
      SELECT * 
      FROM db_manaus.dbfpgto 
      LIMIT 5
    `);

    console.log(`Total de colunas: ${Object.keys(exemplos.rows[0] || {}).length}`);
    console.log(`Registros encontrados: ${exemplos.rowCount}\n`);

    if (exemplos.rows.length > 0) {
      console.log('Primeiro registro:');
      Object.entries(exemplos.rows[0]).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    // Verificar relação com dbpgto
    console.log('\n==========================================');
    console.log('RELAÇÃO DBPGTO ↔ DBFPGTO:');
    console.log('==========================================\n');

    const relacao = await client.query(`
      SELECT 
        p.cod_pgto,
        p.valor_pgto as valor_total,
        COUNT(f.cod_pgto) as qtd_pagamentos,
        COALESCE(SUM(f.valor_pgto), 0) as total_pago,
        p.valor_pgto - COALESCE(SUM(f.valor_pgto), 0) as saldo_restante
      FROM db_manaus.dbpgto_ent p
      LEFT JOIN db_manaus.dbfpgto f ON f.cod_pgto = p.cod_pgto
      WHERE p.paga = 'S'
      GROUP BY p.cod_pgto, p.valor_pgto
      HAVING COUNT(f.cod_pgto) > 0
      ORDER BY p.cod_pgto DESC
      LIMIT 10
    `);

    if (relacao.rows.length > 0) {
      console.log('Contas com pagamentos registrados:\n');
      relacao.rows.forEach((row, i) => {
        console.log(`${i + 1}. Conta ${row.cod_pgto}:`);
        console.log(`   Valor Total: R$ ${parseFloat(row.valor_total).toFixed(2)}`);
        console.log(`   Total Pago: R$ ${parseFloat(row.total_pago).toFixed(2)}`);
        console.log(`   Saldo Restante: R$ ${parseFloat(row.saldo_restante).toFixed(2)}`);
        console.log(`   Qtd Pagamentos: ${row.qtd_pagamentos}\n`);
      });
    } else {
      console.log('Nenhuma conta com pagamentos registrados em DBFPGTO\n');
    }

    console.log('✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verificarDBFPGTO();

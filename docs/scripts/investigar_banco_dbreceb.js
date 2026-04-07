const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function investigarBanco() {
  try {
    console.log('🔍 Investigando estrutura de banco em dbreceb...\n');

    // Verificar como os bancos estão cadastrados
    const queryBancos = `
      SELECT DISTINCT 
        r.banco,
        r.nro_banco,
        cb.nome as nome_banco,
        cb.n_agencia,
        COUNT(*) as qtd_titulos
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = r.banco
      WHERE r.dt_venc BETWEEN '2001-01-01' AND '2025-12-31'
        AND COALESCE(r.forma_fat, '') = '2'
      GROUP BY r.banco, r.nro_banco, cb.nome, cb.n_agencia
      ORDER BY qtd_titulos DESC
      LIMIT 20;
    `;

    const result = await pool.query(queryBancos);

    console.log('📊 Distribuição de títulos por banco:\n');
    console.log('BANCO | NRO_BANCO | NOME                    | AGÊNCIA   | QTD TÍTULOS');
    console.log('------|-----------|-------------------------|-----------|------------');
    
    result.rows.forEach(row => {
      const banco = (row.banco || 'NULL').padEnd(5);
      const nroBanco = (row.nro_banco || 'NULL').padEnd(9);
      const nome = (row.nome_banco || 'SEM NOME').padEnd(23);
      const agencia = (row.n_agencia || 'NULL').padEnd(9);
      const qtd = String(row.qtd_titulos).padStart(11);
      console.log(`${banco} | ${nroBanco} | ${nome} | ${agencia} | ${qtd}`);
    });

    console.log('\n🔍 Verificando estrutura da tabela dbreceb (campos de banco):\n');

    const queryColunas = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbreceb'
        AND column_name LIKE '%banco%'
      ORDER BY ordinal_position;
    `;

    const resultColunas = await pool.query(queryColunas);

    console.log('COLUNA              | TIPO         | NULLABLE');
    console.log('--------------------|--------------|----------');
    resultColunas.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(19)} | ${row.data_type.padEnd(12)} | ${row.is_nullable}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

investigarBanco();

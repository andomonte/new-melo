const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});


async function verificarBancosCadastrados() {
  try {
    console.log('🏦 Verificando bancos cadastrados na tabela dbbanco...\n');

    const query = `
      SELECT 
        cod_banco,
        cod_bc,
        nome,
        n_agencia,
        cidade,
        uf
      FROM db_manaus.dbbanco
      ORDER BY cod_banco;
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum banco cadastrado!');
      return;
    }

    console.log(`✅ ${result.rows.length} bancos cadastrados:\n`);
    console.log('COD_BANCO | COD_BC | NOME                              | AGÊNCIA    | CIDADE');
    console.log('----------|--------|-----------------------------------|------------|------------------');
    
    result.rows.forEach(row => {
      const codBanco = (row.cod_banco || '').padEnd(9);
      const codBc = (row.cod_bc || '').padEnd(6);
      const nome = (row.nome || '').substring(0, 33).padEnd(33);
      const agencia = (row.n_agencia || '').padEnd(10);
      const cidade = (row.cidade || '').substring(0, 16);
      console.log(`${codBanco} | ${codBc} | ${nome} | ${agencia} | ${cidade}`);
    });

    console.log('\n🔍 Verificando títulos vs bancos cadastrados:\n');

    const queryMatch = `
      SELECT 
        r.banco,
        CASE 
          WHEN cb.cod_banco IS NOT NULL THEN 'CADASTRADO'
          ELSE 'SEM CADASTRO'
        END as status,
        COUNT(*) as qtd_titulos
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = r.banco
      WHERE r.forma_fat = '2'
      GROUP BY r.banco, cb.cod_banco
      ORDER BY qtd_titulos DESC
      LIMIT 10;
    `;

    const resultMatch = await pool.query(queryMatch);

    console.log('BANCO | STATUS        | QTD TÍTULOS');
    console.log('------|---------------|------------');
    resultMatch.rows.forEach(row => {
      const banco = (row.banco || 'NULL').padEnd(5);
      const status = row.status.padEnd(13);
      const qtd = String(row.qtd_titulos).padStart(11);
      console.log(`${banco} | ${status} | ${qtd}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarBancosCadastrados();

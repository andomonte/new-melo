const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
  ssl: false
});

async function run() {
  const client = await pool.connect();
  await client.query('SET search_path TO db_manaus');

  try {
    // Buscar item atual
    const item = await client.query(`
      SELECT codprod, qtd, prunit, baseicms, totalproduto, icms
      FROM dbitvenda
      WHERE codvenda = '002439896'
    `);

    console.log('=== ANTES DA CORREÇÃO ===');
    console.log(item.rows[0]);

    const qtd = Number(item.rows[0].qtd);
    const prunit = Number(item.rows[0].prunit);
    const icmsAliq = Number(item.rows[0].icms);

    // Calcular valores corretos
    const valorBruto = qtd * prunit;  // 6 * 5.30 = 31.80
    const totalicms = (valorBruto * icmsAliq / 100).toFixed(4);  // 31.80 * 18% = 5.724

    console.log('\n=== VALORES CORRETOS ===');
    console.log('Valor bruto (qtd × prunit):', valorBruto.toFixed(2));
    console.log('Total ICMS (base × aliq):', totalicms);

    // Atualizar
    await client.query(`
      UPDATE dbitvenda
      SET baseicms = $1,
          totalproduto = $1,
          totalicms = $2,
          basepis = $1,
          basecofins = $1,
          valorpis = ROUND($1 * 1.65 / 100, 4),
          valorcofins = ROUND($1 * 7.60 / 100, 4)
      WHERE codvenda = '002439896'
    `, [valorBruto, totalicms]);

    console.log('\n✅ Venda 002439896 corrigida!');

    // Verificar resultado
    const depois = await client.query(`
      SELECT codprod, qtd, prunit, baseicms, totalproduto, totalicms, icms,
             basepis, basecofins, valorpis, valorcofins
      FROM dbitvenda
      WHERE codvenda = '002439896'
    `);

    console.log('\n=== DEPOIS DA CORREÇÃO ===');
    console.log(depois.rows[0]);

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

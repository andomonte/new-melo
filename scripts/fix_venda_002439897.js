const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
  ssl: false
});

async function run() {
  const client = await pool.connect();
  await client.query('SET search_path TO db_manaus');

  try {
    // Buscar item 3 atual
    const antes = await client.query(`
      SELECT nritem, codprod, qtd, prunit, baseicms, totalicms, totalproduto,
             basepis, basecofins, valorpis, valorcofins, baseipi, totalipi,
             aliquota_icms, aliquota_ipi, valor_ibs, valor_cbs
      FROM dbitvenda
      WHERE codvenda = '002439897' AND nritem = '3'
    `);

    console.log('=== ANTES DA CORREÇÃO (Item 3) ===');
    console.log(antes.rows[0]);

    const item = antes.rows[0];
    const qtd = Number(item.qtd);  // 2
    const prunit = Number(item.prunit);  // 3.95
    const aliqICMS = Number(item.aliquota_icms) || 18;  // 18%

    // Calcular valores corretos
    const valorBruto = qtd * prunit;  // 2 * 3.95 = 7.90
    const totalicms = (valorBruto * aliqICMS / 100);  // 7.90 * 18% = 1.422
    const valorpis = (valorBruto * 1.65 / 100);  // 7.90 * 1.65% = 0.13035
    const valorcofins = (valorBruto * 7.60 / 100);  // 7.90 * 7.60% = 0.6004
    const valor_ibs = (valorBruto * 0.10 / 100);  // 7.90 * 0.10% = 0.0079
    const valor_cbs = (valorBruto * 0.90 / 100);  // 7.90 * 0.90% = 0.0711

    console.log('\n=== VALORES CORRETOS ===');
    console.log('valorBruto (qtd × prunit):', valorBruto.toFixed(2));
    console.log('totalicms (base × 18%):', totalicms.toFixed(4));
    console.log('valorpis (base × 1.65%):', valorpis.toFixed(4));
    console.log('valorcofins (base × 7.60%):', valorcofins.toFixed(4));
    console.log('valor_ibs (base × 0.10%):', valor_ibs.toFixed(4));
    console.log('valor_cbs (base × 0.90%):', valor_cbs.toFixed(4));

    // Atualizar
    await client.query(`
      UPDATE dbitvenda
      SET baseicms = $1,
          totalproduto = $1,
          totalicms = $2,
          basepis = $1,
          basecofins = $1,
          baseipi = $1,
          valorpis = $3,
          valorcofins = $4,
          valor_ibs = $5,
          valor_cbs = $6
      WHERE codvenda = '002439897' AND nritem = '3'
    `, [valorBruto, totalicms, valorpis, valorcofins, valor_ibs, valor_cbs]);

    console.log('\n✅ Item 3 da venda 002439897 corrigido!');

    // Verificar resultado
    const depois = await client.query(`
      SELECT nritem, codprod, qtd, prunit, baseicms, totalicms, totalproduto,
             basepis, basecofins, valorpis, valorcofins,
             valor_ibs, valor_cbs
      FROM dbitvenda
      WHERE codvenda = '002439897' AND nritem = '3'
    `);

    console.log('\n=== DEPOIS DA CORREÇÃO ===');
    console.log(depois.rows[0]);

    // Verificar total da venda
    const totais = await client.query(`
      SELECT
        SUM(baseicms) as total_baseicms,
        SUM(totalicms) as total_icms,
        SUM(totalproduto) as total_produtos
      FROM dbitvenda
      WHERE codvenda = '002439897'
    `);

    console.log('\n=== TOTAIS DA VENDA 002439897 ===');
    console.log('Total Base ICMS:', Number(totais.rows[0].total_baseicms).toFixed(2));
    console.log('Total ICMS:', Number(totais.rows[0].total_icms).toFixed(2));
    console.log('Total Produtos:', Number(totais.rows[0].total_produtos).toFixed(2));

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
  ssl: false
});

async function run() {
  const client = await pool.connect();
  await client.query('SET search_path TO db_manaus');

  // Buscar dados da venda
  const venda = await client.query(`
    SELECT codvenda, nrovenda, codcli, total, data, status, tipo
    FROM dbvenda
    WHERE codvenda = '002439896'
  `);
  console.log('=== VENDA ===');
  console.log(venda.rows[0]);

  // Buscar itens da venda com valores de ICMS
  const itens = await client.query(`
    SELECT codprod, ref, qtd, prunit,
           baseicms, icms, totalicms,
           basesubst_trib, totalsubst_trib,
           totalproduto,
           (prunit * qtd) as valor_bruto
    FROM dbitvenda
    WHERE codvenda = '002439896'
    ORDER BY codprod
  `);

  console.log('\n=== ITENS (', itens.rows.length, 'itens) ===');
  let somaBaseIcms = 0;
  let somaTotalIcms = 0;
  let somaTotal = 0;

  itens.rows.forEach((it, i) => {
    console.log(`Item ${i+1}: codprod=${it.codprod}, ref=${it.ref}, qtd=${it.qtd}, prunit=${it.prunit}`);
    console.log(`  baseicms=${it.baseicms}, icms=${it.icms}%, totalicms=${it.totalicms}`);
    console.log(`  totalproduto=${it.totalproduto}, valor_bruto=${it.valor_bruto}`);
    somaBaseIcms += Number(it.baseicms || 0);
    somaTotalIcms += Number(it.totalicms || 0);
    somaTotal += Number(it.totalproduto || it.valor_bruto || 0);
  });

  console.log('\n=== TOTAIS CALCULADOS ===');
  console.log('Soma baseicms:', somaBaseIcms.toFixed(2));
  console.log('Soma totalicms:', somaTotalIcms.toFixed(2));
  console.log('Soma totalproduto:', somaTotal.toFixed(2));

  client.release();
  await pool.end();
}
run();

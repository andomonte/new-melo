import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarImpostosIBSCBS() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Consultando Impostos IBS/CBS ===\n');

    // Consulta 1: Verificar se as colunas existem
    console.log('1. Verificando estrutura da tabela dbitvenda...');
    const estrutura = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dbitvenda'
        AND column_name IN ('aliquota_ibs', 'aliquota_cbs', 'valor_ibs', 'valor_cbs')
      ORDER BY column_name;
    `);
    
    console.table(estrutura.rows);

    // Consulta 2: Buscar registros com impostos IBS/CBS
    console.log('\n2. Buscando registros com impostos IBS/CBS...');
    const registros = await client.query(`
      SELECT 
        v.codvenda,
        v.nrovenda,
        v.data,
        i.codprod,
        i.descr,
        i.qtd,
        i.prunit,
        i.totalproduto,
        i.aliquota_ibs,
        i.valor_ibs,
        i.aliquota_cbs,
        i.valor_cbs
      FROM dbvenda v
      INNER JOIN dbitvenda i ON v.codvenda = i.codvenda
      WHERE i.aliquota_ibs IS NOT NULL 
         OR i.valor_ibs IS NOT NULL
         OR i.aliquota_cbs IS NOT NULL
         OR i.valor_cbs IS NOT NULL
      ORDER BY v.data DESC, v.codvenda DESC
      LIMIT 20;
    `);

    if (registros.rows.length > 0) {
      console.log(`\nEncontrados ${registros.rows.length} registros:`);
      registros.rows.forEach((reg, idx) => {
        console.log(`\n--- Registro ${idx + 1} ---`);
        console.log(`Venda: ${reg.codvenda} (${reg.nrovenda}) | Data: ${reg.data}`);
        console.log(`Produto: ${reg.codprod} - ${reg.descr}`);
        console.log(`Qtd: ${reg.qtd} | Valor Unit: R$ ${parseFloat(reg.prunit).toFixed(2)}`);
        console.log(`Valor Total: R$ ${parseFloat(reg.totalproduto || 0).toFixed(2)}`);
        console.log(`IBS: ${reg.aliquota_ibs}% = R$ ${parseFloat(reg.valor_ibs || 0).toFixed(2)}`);
        console.log(`CBS: ${reg.aliquota_cbs}% = R$ ${parseFloat(reg.valor_cbs || 0).toFixed(2)}`);
      });
    } else {
      console.log('\nNenhum registro encontrado com impostos IBS/CBS.');
    }

    // Consulta 3: Estatísticas
    console.log('\n3. Estatísticas de impostos IBS/CBS...');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(CASE WHEN aliquota_ibs IS NOT NULL THEN 1 END) as com_ibs,
        COUNT(CASE WHEN aliquota_cbs IS NOT NULL THEN 1 END) as com_cbs,
        ROUND(AVG(NULLIF(aliquota_ibs, 0)), 2) as media_aliquota_ibs,
        ROUND(AVG(NULLIF(aliquota_cbs, 0)), 2) as media_aliquota_cbs,
        ROUND(SUM(COALESCE(valor_ibs, 0)), 2) as total_valor_ibs,
        ROUND(SUM(COALESCE(valor_cbs, 0)), 2) as total_valor_cbs
      FROM dbitvenda;
    `);

    console.table(stats.rows);

    // Consulta 4: Últimas vendas emitidas
    console.log('\n4. Últimas 10 vendas...');
    const ultimasVendas = await client.query(`
      SELECT 
        v.codvenda,
        v.nrovenda,
        v.data,
        v.total,
        COUNT(i.ref) as qtd_itens,
        ROUND(SUM(COALESCE(i.valor_ibs, 0)), 2) as total_ibs,
        ROUND(SUM(COALESCE(i.valor_cbs, 0)), 2) as total_cbs
      FROM dbvenda v
      LEFT JOIN dbitvenda i ON v.codvenda = i.codvenda
      GROUP BY v.codvenda, v.nrovenda, v.data, v.total
      ORDER BY v.data DESC, v.codvenda DESC
      LIMIT 10;
    `);

    console.log('\nÚltimas vendas:');
    console.table(ultimasVendas.rows);

  } catch (error) {
    console.error('Erro ao consultar impostos:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar consulta
consultarImpostosIBSCBS()
  .then(() => {
    console.log('\n✅ Consulta concluída!');
    pool.end();
  })
  .catch((error) => {
    console.error('❌ Erro:', error.message);
    pool.end();
    process.exit(1);
  });

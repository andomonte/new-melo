const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
async function verificarFormaFat() {
 

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    const dtini = '2024-01-01';
    const dtfim = '2025-12-31';
    const codBc = '237'; // BRADESCO

    // Verificar valores de forma_fat
    console.log('🔍 Valores de FORMA_FAT nos títulos do BRADESCO:\n');
    const formasFat = await client.query(`
      SELECT 
        COALESCE(r.forma_fat, 'NULL') as forma_fat,
        COUNT(*) as quantidade,
        SUM(r.valor_pgto) as valor_total
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
      GROUP BY r.forma_fat
      ORDER BY quantidade DESC
    `, [dtini, dtfim, codBc]);

    console.log('FORMA_FAT | QUANTIDADE | VALOR TOTAL');
    console.log('----------|------------|------------------');
    formasFat.rows.forEach(row => {
      const forma = (row.forma_fat || 'NULL').padEnd(9);
      const qtd = String(row.quantidade).padStart(10);
      const valor = parseFloat(row.valor_total || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).padStart(16);
      console.log(`${forma} | ${qtd} | ${valor}`);
    });

    console.log('\n🔍 Significado dos códigos de FORMA_FAT:\n');
    console.log('  "1" ou "01" = Dinheiro/À vista');
    console.log('  "2" ou "02" = Boleto Bancário');
    console.log('  "3" ou "03" = Cheque');
    console.log('  "4" ou "04" = Cartão de Crédito');
    console.log('  "5" ou "05" = Crediário/Faturado');
    console.log('  NULL = Não definido\n');

    // Verificar se há títulos com forma_fat parecida com boleto
    console.log('🔍 Procurando variações de código de boleto:\n');
    const variacoes = await client.query(`
      SELECT 
        r.forma_fat,
        COUNT(*) as qtd
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND cb.cod_bc = $3
        AND (
          r.forma_fat IN ('2', '02', 'B', 'BOL', 'BOLETO')
          OR r.forma_fat LIKE '%BOLET%'
          OR r.forma_fat LIKE '%BANC%'
        )
      GROUP BY r.forma_fat
    `, [dtini, dtfim, codBc]);

    if (variacoes.rows.length > 0) {
      console.log('Encontradas variações:');
      variacoes.rows.forEach(row => {
        console.log(`  "${row.forma_fat}": ${row.qtd} títulos`);
      });
    } else {
      console.log('❌ Nenhum título com forma_fat relacionada a boleto encontrado!\n');
      
      // Mostrar amostra de títulos
      console.log('📋 Amostra de 10 títulos do BRADESCO:\n');
      const amostra = await client.query(`
        SELECT 
          r.cod_receb,
          r.nro_doc,
          r.valor_pgto,
          r.dt_venc,
          r.forma_fat,
          r.bradesco,
          r.cancel,
          r.rec,
          r.banco as banco_interno,
          cb.cod_bc,
          cb.nome as nome_banco
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
        WHERE r.dt_venc BETWEEN $1 AND $2
          AND cb.cod_bc = $3
        LIMIT 10
      `, [dtini, dtfim, codBc]);

      console.log('COD_RECEB | NRO_DOC | VALOR | VENCIMENTO | FORMA_FAT | BRADESCO | CANCEL | REC | BANCO');
      console.log('----------|---------|-------|------------|-----------|----------|--------|-----|-------');
      amostra.rows.forEach(row => {
        const cod = (row.cod_receb || '').toString().padEnd(9);
        const doc = (row.nro_doc || '').padEnd(7);
        const valor = parseFloat(row.valor_pgto || 0).toFixed(2).padStart(5);
        const venc = row.dt_venc ? new Date(row.dt_venc).toLocaleDateString('pt-BR') : ''.padEnd(10);
        const forma = (row.forma_fat || 'NULL').padEnd(9);
        const brad = (row.bradesco || 'NULL').padEnd(8);
        const cancel = (row.cancel || 'NULL').padEnd(6);
        const rec = (row.rec || 'NULL').padEnd(3);
        const banco = (row.nome_banco || '').substring(0, 15);
        console.log(`${cod} | ${doc} | ${valor} | ${venc} | ${forma} | ${brad} | ${cancel} | ${rec} | ${banco}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n✅ Conexão fechada');
  }
}

verificarFormaFat();

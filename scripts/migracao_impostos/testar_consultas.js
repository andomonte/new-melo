const { Client } = require('pg');

const PG_CONFIG = {
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
};

async function main() {
  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();

  console.log('='.repeat(80));
  console.log('TESTE DE CONSULTAS - CÁLCULO DE IMPOSTOS');
  console.log('='.repeat(80));

  // Teste 1: Buscar MVA por NCM específico
  console.log('\n1. TESTE: Buscar MVA para NCM 84213920');
  console.log('-'.repeat(80));

  const query1 = `
    SELECT
      l."LEI_PROTOCOLO",
      l."LEI_TIPO",
      l."LEI_STATUS",
      l."LEI_MVA_AJUSTADA" AS formula_mva,
      ln."LIN_NCM",
      ln."LIN_MVA_ST_ORIGINAL" AS mva_percentual,
      ln."LIN_CEST"
    FROM cad_legislacao_icmsst_ncm ln
    INNER JOIN cad_legislacao_icmsst l
      ON l."LEI_ID" = ln."LIN_LEI_ID"
    WHERE ln."LIN_NCM" = '84213920'
      AND ln."LIN_STATUS" = 'REGRA'
      AND l."LEI_STATUS" = 'EM VIGOR'
    LIMIT 1;
  `;

  try {
    const result1 = await pgClient.query(query1);
    if (result1.rows.length > 0) {
      console.log('✓ Encontrado!');
      console.log(JSON.stringify(result1.rows[0], null, 2));
    } else {
      console.log('✗ Nenhum resultado encontrado');
    }
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  // Teste 2: Contar NCMs por protocolo
  console.log('\n2. TESTE: Contar NCMs por protocolo em vigor');
  console.log('-'.repeat(80));

  const query2 = `
    SELECT
      l."LEI_PROTOCOLO" AS protocolo,
      l."LEI_TIPO" AS tipo,
      COUNT(ln."LIN_ID") AS total_ncms
    FROM cad_legislacao_icmsst l
    LEFT JOIN cad_legislacao_icmsst_ncm ln
      ON ln."LIN_LEI_ID" = l."LEI_ID"
      AND ln."LIN_STATUS" = 'REGRA'
    WHERE l."LEI_STATUS" = 'EM VIGOR'
    GROUP BY l."LEI_PROTOCOLO", l."LEI_TIPO"
    ORDER BY total_ncms DESC
    LIMIT 5;
  `;

  try {
    const result2 = await pgClient.query(query2);
    console.log(`✓ Top 5 protocolos com mais NCMs:`);
    console.table(result2.rows);
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  // Teste 3: Buscar CESTs de autopeças
  console.log('\n3. TESTE: Buscar CESTs do segmento AUTOPEÇAS');
  console.log('-'.repeat(80));

  const query3 = `
    SELECT
      cest,
      ncm,
      descricao
    FROM dbcest
    WHERE segmento = 'AUTOPEÇAS'
    ORDER BY cest
    LIMIT 5;
  `;

  try {
    const result3 = await pgClient.query(query3);
    console.log(`✓ Encontrados ${result3.rows.length} CESTs:`);
    console.table(result3.rows);
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  // Teste 4: Buscar alíquota por código
  console.log('\n4. TESTE: Buscar alíquota para código A001');
  console.log('-'.repeat(80));

  const query4 = `
    SELECT
      codigo,
      n_ne_co AS aliq_n_ne_co,
      s_se AS aliq_s_se,
      importado AS aliq_importado
    FROM fis_tributo_aliquota
    WHERE codigo = 'A001';
  `;

  try {
    const result4 = await pgClient.query(query4);
    if (result4.rows.length > 0) {
      console.log('✓ Encontrado!');
      console.log(JSON.stringify(result4.rows[0], null, 2));
    } else {
      console.log('✗ Nenhum resultado encontrado');
    }
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  // Teste 5: Estatísticas gerais
  console.log('\n5. TESTE: Estatísticas gerais das tabelas');
  console.log('-'.repeat(80));

  const query5 = `
    SELECT
      'CAD_LEGISLACAO_ICMSST' AS tabela,
      COUNT(*) AS total,
      COUNT(CASE WHEN "LEI_STATUS" = 'EM VIGOR' THEN 1 END) AS em_vigor
    FROM cad_legislacao_icmsst

    UNION ALL

    SELECT
      'CAD_LEGISLACAO_ICMSST_NCM' AS tabela,
      COUNT(*) AS total,
      COUNT(CASE WHEN "LIN_STATUS" = 'REGRA' THEN 1 END) AS regras
    FROM cad_legislacao_icmsst_ncm

    UNION ALL

    SELECT
      'FIS_TRIBUTO_ALIQUOTA' AS tabela,
      COUNT(*) AS total,
      NULL AS campo2
    FROM fis_tributo_aliquota

    UNION ALL

    SELECT
      'DBCEST' AS tabela,
      COUNT(*) AS total,
      COUNT(DISTINCT segmento) AS segmentos
    FROM dbcest;
  `;

  try {
    const result5 = await pgClient.query(query5);
    console.log('✓ Estatísticas:');
    console.table(result5.rows);
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  // Teste 6: Verificar performance do índice
  console.log('\n6. TESTE: Performance de busca por NCM (usando índice)');
  console.log('-'.repeat(80));

  const query6 = `
    EXPLAIN ANALYZE
    SELECT ln."LIN_NCM", ln."LIN_MVA_ST_ORIGINAL"
    FROM cad_legislacao_icmsst_ncm ln
    WHERE ln."LIN_NCM" = '84213920';
  `;

  try {
    const result6 = await pgClient.query(query6);
    console.log('✓ Plano de execução:');
    result6.rows.forEach(row => {
      console.log(row['QUERY PLAN']);
    });
  } catch (err) {
    console.log('✗ ERRO:', err.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TESTES CONCLUÍDOS');
  console.log('='.repeat(80));

  await pgClient.end();
}

main().catch(console.error);

/**
 * TESTE PILOTO - Simulador Comparativo
 *
 * Executa um teste rápido para validar o simulador
 * com dados reais do banco
 */

const { Pool } = require('pg');

const PG_CONFIG = {
  user: 'postgres',
  password: 'Melodb@2025',
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  options: '-c search_path=db_manaus'
};

async function testePiloto() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  TESTE PILOTO - Simulador Comparativo    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const pool = new Pool(PG_CONFIG);

  try {
    // 1. Buscar produtos disponíveis
    console.log('🔍 Buscando produtos disponíveis...\n');

    const produtos = await pool.query(`
      SELECT
        p."ID_PRODUTO" as id_produto,
        p."CODIGO" as codigo,
        p."DESCRICAO" as descricao,
        p."NCM" as ncm,
        COALESCE(p."IPI", 0) as ipi,
        COALESCE(p."PIS", 0) as pis,
        COALESCE(p."COFINS", 0) as cofins,
        p."UF_ORIGEM" as uf_origem
      FROM db_manaus.dbprod p
      WHERE p."DESCRICAO" IS NOT NULL
        AND p."NCM" IS NOT NULL
        AND LENGTH(p."NCM") >= 8
      ORDER BY p."ID_PRODUTO"
      LIMIT 10
    `);

    if (produtos.rows.length === 0) {
      console.log('⚠ Nenhum produto encontrado no banco PostgreSQL');
      return;
    }

    console.log(`✓ ${produtos.rows.length} produtos encontrados:\n`);

    produtos.rows.forEach((p, i) => {
      console.log(`${i + 1}. [${p.id_produto}] ${p.descricao}`);
      console.log(`   NCM: ${p.ncm} | IPI: ${p.ipi}% | UF: ${p.uf_origem || 'N/A'}\n`);
    });

    // 2. Buscar clientes disponíveis
    console.log('\n🔍 Buscando clientes disponíveis...\n');

    const clientes = await pool.query(`
      SELECT
        c."ID_CLIENTE" as id_cliente,
        c."CODIGO" as codigo,
        c."NOME" as nome,
        c."UF" as uf,
        c."INSCRICAO_ESTADUAL" as inscricao_estadual
      FROM db_manaus.dbcliente c
      WHERE c."NOME" IS NOT NULL
      ORDER BY c."ID_CLIENTE"
      LIMIT 10
    `);

    if (clientes.rows.length === 0) {
      console.log('⚠ Nenhum cliente encontrado no banco PostgreSQL');
      return;
    }

    console.log(`✓ ${clientes.rows.length} clientes encontrados:\n`);

    clientes.rows.forEach((c, i) => {
      console.log(`${i + 1}. [${c.id_cliente}] ${c.nome}`);
      console.log(`   UF: ${c.uf || 'N/A'} | IE: ${c.inscricao_estadual || 'Não informado'}\n`);
    });

    // 3. Verificar tabelas de impostos
    console.log('\n🔍 Verificando tabelas de impostos...\n');

    const mvaTables = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT "LIN_NCM") as ncms_distintos
      FROM db_manaus.cad_legislacao_icmsst_ncm
    `);

    console.log(`✓ Tabela MVA: ${mvaTables.rows[0].total} registros, ${mvaTables.rows[0].ncms_distintos} NCMs distintos`);

    // 4. Testar busca de MVA para o primeiro produto
    const primeiroProduto = produtos.rows[0];

    console.log(`\n🔍 Testando busca de MVA para NCM: ${primeiroProduto.ncm}...\n`);

    const mva = await pool.query(`
      SELECT
        ln."LIN_NCM",
        ln."LIN_MVA_ST_ORIGINAL",
        l."LEI_PROTOCOLO"
      FROM db_manaus.cad_legislacao_icmsst_ncm ln
      JOIN db_manaus.cad_legislacao_icmsst l
        ON l."LEI_ID" = ln."LIN_LEI_ID"
      WHERE ln."LIN_NCM" = $1
        AND ln."LIN_STATUS" = 'REGRA'
        AND l."LEI_STATUS" = 'EM VIGOR'
      LIMIT 5
    `, [primeiroProduto.ncm]);

    if (mva.rows.length > 0) {
      console.log(`✓ ${mva.rows.length} MVAs encontrados:\n`);
      mva.rows.forEach(m => {
        console.log(`   Protocolo ${m.LEI_PROTOCOLO}: MVA = ${m.LIN_MVA_ST_ORIGINAL}%`);
      });
    } else {
      console.log(`⚠ Nenhum MVA encontrado para NCM ${primeiroProduto.ncm}`);
    }

    // 5. Sugestão de teste
    console.log('\n' + '═'.repeat(60));
    console.log('📝 SUGESTÃO DE TESTE PILOTO\n');
    console.log('Execute o simulador com estes dados:\n');
    console.log(`Produto: ${primeiroProduto.id_produto}`);
    console.log(`         (${primeiroProduto.descricao})`);
    console.log(`\nCliente: ${clientes.rows[0].id_cliente}`);
    console.log(`         (${clientes.rows[0].nome})`);
    console.log(`\nValor: 1000`);
    console.log(`Quantidade: 1`);
    console.log('\n' + '═'.repeat(60));

    console.log('\n🚀 Para executar o teste:\n');
    console.log('   node scripts/migracao_impostos/simulador-comparativo.js\n');

  } catch (error) {
    console.error('✗ Erro:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testePiloto();

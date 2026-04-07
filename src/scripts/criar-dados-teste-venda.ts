/**
 * Script para criar dados de teste para Promocao e Kickback
 *
 * Executar com: npx tsx src/scripts/criar-dados-teste-venda.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Pool, PoolClient } from 'pg';

// =============================================================================
// Configuracao do Pool
// =============================================================================

type PgPoolMap = Record<string, Pool>;
const pgPools: PgPoolMap = {};

function toDbEnvKey(name: string): string {
  const dbName = String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '_');
  return `DATABASE_URL_${dbName}`;
}

function getPgPool(filialOrDbName: string): Pool {
  if (!filialOrDbName || !String(filialOrDbName).trim()) {
    throw new Error(`Filial invalida ao obter Pool PG.`);
  }

  const cacheKey = String(filialOrDbName).trim().toUpperCase();
  const envKey = toDbEnvKey(filialOrDbName);
  let dbUrl = process.env[envKey];

  if (!dbUrl && process.env.DATABASE_URL_DEFAULT) {
    dbUrl = process.env.DATABASE_URL_DEFAULT!;
  }

  if (!dbUrl) {
    throw new Error(`Variavel de ambiente nao encontrada: ${envKey}`);
  }

  if (!pgPools[cacheKey]) {
    const conn = dbUrl.includes('connect_timeout')
      ? dbUrl
      : `${dbUrl}?connect_timeout=30`;

    pgPools[cacheKey] = new Pool({
      connectionString: conn,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return pgPools[cacheKey]!;
}

// =============================================================================
// Constantes
// =============================================================================

const FILIAL = process.env.FILIAL_TESTE || 'MANAUS';

// =============================================================================
// Funcoes de Busca
// =============================================================================

/**
 * Busca um produto com estoque disponivel
 */
async function buscarProdutoComEstoque(client: PoolClient): Promise<any> {
  console.log('\n[1] Buscando produto com estoque disponivel...');

  const query = `
    SELECT
      p.codprod,
      p.descr,
      p.ref,
      p.codgpp,
      COALESCE(cs.qtest, 0) - COALESCE(cs.qtdreservada, 0) AS disponivel,
      fp."PRECOVENDA" as precovenda,
      m.descr AS marca
    FROM dbprod p
    LEFT JOIN (
      SELECT
        btrim(arp_codprod) AS codprod_txt,
        SUM(arp_qtest) AS qtest,
        SUM(COALESCE(arp_qtest_reservada, 0)) AS qtdreservada
      FROM cad_armazem_produto
      WHERE COALESCE(arp_bloqueado,'N') <> 'S'
      GROUP BY btrim(arp_codprod)
    ) cs ON cs.codprod_txt = btrim(p.codprod::text)
    LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
    LEFT JOIN dbformacaoprvenda fp ON btrim(p.codprod::text) = btrim(fp."CODPROD"::text)
      AND fp."TIPOPRECO"::text = '0'
    WHERE fp."PRECOVENDA" > 0
      AND COALESCE(p.inf, '') <> 'D'
      AND COALESCE(p.excluido, 0) <> 1
      AND (COALESCE(cs.qtest, 0) - COALESCE(cs.qtdreservada, 0)) >= 10
    ORDER BY RANDOM()
    LIMIT 1
  `;

  const result = await client.query(query);

  if (result.rows.length === 0) {
    throw new Error('Nenhum produto com estoque encontrado!');
  }

  const produto = result.rows[0];
  console.log(`   [OK] Produto encontrado:`);
  console.log(`        Codigo:     ${produto.codprod}`);
  console.log(`        Descricao:  ${produto.descr?.substring(0, 50) || 'N/A'}`);
  console.log(`        Ref:        ${produto.ref || 'N/A'}`);
  console.log(`        Disponivel: ${produto.disponivel}`);
  console.log(`        Preco:      R$ ${Number(produto.precovenda || 0).toFixed(2)}`);

  return produto;
}

/**
 * Busca um cliente ativo (que nao seja BALCAO)
 */
async function buscarClienteAtivo(client: PoolClient): Promise<any> {
  console.log('\n[2] Buscando cliente ativo (nao BALCAO)...');

  const query = `
    SELECT
      codcli,
      nome,
      nomefant,
      cidade,
      uf,
      COALESCE(kickback, 0) as kickback
    FROM dbclien
    WHERE COALESCE(status, '1') IN ('1', '2')
      AND UPPER(nome) NOT LIKE '%BALC%'
      AND UPPER(nome) NOT LIKE '%CONSUMIDOR%'
      AND codcli IS NOT NULL
      AND nome IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 1
  `;

  const result = await client.query(query);

  if (result.rows.length === 0) {
    throw new Error('Nenhum cliente ativo encontrado!');
  }

  const cliente = result.rows[0];
  console.log(`   [OK] Cliente encontrado:`);
  console.log(`        Codigo: ${cliente.codcli}`);
  console.log(`        Nome:   ${cliente.nome?.substring(0, 40) || 'N/A'}`);
  console.log(`        Cidade: ${cliente.cidade || 'N/A'} - ${cliente.uf || 'N/A'}`);

  return cliente;
}

/**
 * Busca cliente BALCAO
 */
async function buscarClienteBalcao(client: PoolClient): Promise<any> {
  console.log('\n[3] Buscando cliente BALCAO...');

  const query = `
    SELECT
      codcli,
      nome,
      nomefant
    FROM dbclien
    WHERE (UPPER(nome) LIKE '%BALC%' OR UPPER(nome) LIKE '%CONSUMIDOR%')
      AND codcli IS NOT NULL
    ORDER BY codcli
    LIMIT 1
  `;

  const result = await client.query(query);

  if (result.rows.length === 0) {
    console.log('   [INFO] Nenhum cliente BALCAO encontrado.');
    return null;
  }

  const cliente = result.rows[0];
  console.log(`   [OK] Cliente BALCAO encontrado:`);
  console.log(`        Codigo: ${cliente.codcli}`);
  console.log(`        Nome:   ${cliente.nome || 'N/A'}`);

  return cliente;
}

// =============================================================================
// Funcoes de Criacao
// =============================================================================

/**
 * Cria ou verifica promocao ativa para o produto
 */
async function criarPromocao(
  client: PoolClient,
  codprod: string,
  precoOriginal: number
): Promise<any> {
  console.log('\n[4] Verificando/criando promocao para o produto...');

  // Verificar se ja existe promocao ativa
  const checkQuery = `
    SELECT dpi.id_promocao_item, dp.id_promocao, dp.nome_promocao, dpi.valor_desconto_item
    FROM dbpromocao_item dpi
    JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
    WHERE dp.ativa = TRUE
      AND CURRENT_TIMESTAMP BETWEEN dp.data_inicio AND dp.data_fim
      AND dpi.codprod = $1
    LIMIT 1
  `;

  const checkResult = await client.query(checkQuery, [codprod]);

  if (checkResult.rows.length > 0) {
    const promo = checkResult.rows[0];
    const valorDesconto = Number(promo.valor_desconto_item || 15);
    const precoPromo = precoOriginal * (1 - valorDesconto / 100);
    console.log(`   [OK] Promocao ja existe:`);
    console.log(`        ID Promocao:      ${promo.id_promocao}`);
    console.log(`        ID Promocao Item: ${promo.id_promocao_item}`);
    console.log(`        Nome:             ${promo.nome_promocao}`);
    console.log(`        Desconto:         ${valorDesconto}%`);
    return { ...promo, valor_desconto: valorDesconto, preco_promo: precoPromo };
  }

  console.log('   [INFO] Criando nova promocao...');

  const hoje = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 30); // Valida por 30 dias

  const nomePromocao = `TESTE_PROMO_${codprod}`;
  const valorDesconto = 15; // 15% de desconto

  await client.query('BEGIN');

  try {
    // Inserir promocao
    const insertPromo = `
      INSERT INTO dbpromocao (
        nome_promocao, descricao_promocao, data_inicio, data_fim,
        tipo_promocao, valor_desconto, tipo_desconto, qtde_minima_ativacao,
        qtde_maxima_total, ativa, criado_por, observacoes
      )
      VALUES ($1, $2, $3, $4, 'PROD', $5, 'PERC', 1, 100, true, 'SCRIPT', 'Teste automatizado')
      RETURNING id_promocao
    `;

    const promoResult = await client.query(insertPromo, [
      nomePromocao,
      `Promocao de teste - ${valorDesconto}% de desconto`,
      hoje,
      dataFim,
      valorDesconto,
    ]);

    const idPromocao = promoResult.rows[0].id_promocao;

    // Inserir item da promocao
    const insertItem = `
      INSERT INTO dbpromocao_item (
        id_promocao, codprod, valor_desconto_item, tipo_desconto_item,
        qtde_minima_item, qtd_total_item
      )
      VALUES ($1, $2, $3, 'PERC', 1, 50)
      RETURNING id_promocao_item
    `;

    const itemResult = await client.query(insertItem, [
      idPromocao,
      codprod,
      valorDesconto,
    ]);

    const idPromocaoItem = itemResult.rows[0].id_promocao_item;

    await client.query('COMMIT');

    const precoPromo = precoOriginal * (1 - valorDesconto / 100);

    console.log(`   [OK] Promocao criada:`);
    console.log(`        ID Promocao:      ${idPromocao}`);
    console.log(`        ID Promocao Item: ${idPromocaoItem}`);
    console.log(`        Nome:             ${nomePromocao}`);
    console.log(`        Desconto:         ${valorDesconto}%`);
    console.log(`        Preco Original:   R$ ${precoOriginal.toFixed(2)}`);
    console.log(`        Preco Promo:      R$ ${precoPromo.toFixed(2)}`);

    return {
      id_promocao: idPromocao,
      id_promocao_item: idPromocaoItem,
      nome_promocao: nomePromocao,
      valor_desconto: valorDesconto,
      preco_promo: precoPromo,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Cria ou verifica preco kickback para o produto
 */
async function criarPrecoKickback(
  client: PoolClient,
  codprod: string,
  precoOriginal: number
): Promise<any> {
  console.log('\n[5] Verificando/criando preco kickback para o produto...');

  // Verificar se ja existe preco kickback
  const checkQuery = `
    SELECT codprod, dscbalcao45 as preco_kickback
    FROM dbprecokb
    WHERE btrim(codprod::text) = $1
      AND dscbalcao45 IS NOT NULL
      AND dscbalcao45 > 0
    LIMIT 1
  `;

  const checkResult = await client.query(checkQuery, [codprod]);

  if (checkResult.rows.length > 0) {
    const kb = checkResult.rows[0];
    console.log(`   [OK] Preco kickback ja existe:`);
    console.log(`        Preco Kickback: R$ ${Number(kb.preco_kickback).toFixed(2)}`);
    return { preco_kickback: Number(kb.preco_kickback) };
  }

  console.log('   [INFO] Criando preco kickback...');

  // Preco kickback = 20% abaixo do preco original
  const precoKickback = precoOriginal * 0.80;

  // Verificar se a tabela dbprecokb existe
  const checkTable = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name = 'dbprecokb'
  `);

  if (checkTable.rows.length === 0) {
    console.log('   [AVISO] Tabela dbprecokb nao encontrada. Criando...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS dbprecokb (
        codprod VARCHAR(20) PRIMARY KEY,
        dscbalcao45 NUMERIC(15,2),
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Inserir ou atualizar preco kickback
  try {
    const upsertQuery = `
      INSERT INTO dbprecokb (codprod, dscbalcao45)
      VALUES ($1, $2)
      ON CONFLICT (codprod)
      DO UPDATE SET dscbalcao45 = EXCLUDED.dscbalcao45
    `;
    await client.query(upsertQuery, [codprod, precoKickback]);
  } catch (e) {
    // Se falhar o upsert, tenta insert simples
    const insertQuery = `
      INSERT INTO dbprecokb (codprod, dscbalcao45)
      VALUES ($1, $2)
    `;
    try {
      await client.query(insertQuery, [codprod, precoKickback]);
    } catch (e2) {
      // Se ja existe, atualiza
      const updateQuery = `
        UPDATE dbprecokb SET dscbalcao45 = $2 WHERE codprod = $1
      `;
      await client.query(updateQuery, [codprod, precoKickback]);
    }
  }

  console.log(`   [OK] Preco kickback criado:`);
  console.log(`        Preco Original:  R$ ${precoOriginal.toFixed(2)}`);
  console.log(`        Preco Kickback:  R$ ${precoKickback.toFixed(2)} (-20%)`);

  return { preco_kickback: precoKickback };
}

/**
 * Habilita kickback para o cliente
 */
async function habilitarKickbackCliente(
  client: PoolClient,
  codcli: string
): Promise<void> {
  console.log('\n[6] Habilitando kickback para o cliente...');

  // kickback eh um bigint (0 ou 1), nao varchar
  await client.query(
    `UPDATE dbclien SET kickback = 1 WHERE codcli = $1`,
    [codcli]
  );

  console.log(`   [OK] Cliente ${codcli} agora tem kickback = 1`);
}

/**
 * Busca um armazem com estoque do produto
 */
async function buscarArmazemComEstoque(
  client: PoolClient,
  codprod: string
): Promise<number> {
  console.log('\n[7] Buscando armazem com estoque do produto...');

  const query = `
    SELECT
      arp.arp_arm_id as arm_id,
      arm.arm_descricao as descricao,
      (arp.arp_qtest - COALESCE(arp.arp_qtest_reservada, 0)) as disponivel
    FROM cad_armazem_produto arp
    JOIN cad_armazem arm ON arm.arm_id = arp.arp_arm_id
    WHERE btrim(arp.arp_codprod) = $1
      AND COALESCE(arp.arp_bloqueado, 'N') <> 'S'
      AND (arp.arp_qtest - COALESCE(arp.arp_qtest_reservada, 0)) > 0
    ORDER BY disponivel DESC
    LIMIT 1
  `;

  const result = await client.query(query, [codprod]);

  if (result.rows.length === 0) {
    console.log('   [AVISO] Nenhum armazem encontrado, usando padrao 1');
    return 1;
  }

  const arm = result.rows[0];
  console.log(`   [OK] Armazem encontrado:`);
  console.log(`        ID:         ${arm.arm_id}`);
  console.log(`        Descricao:  ${arm.descricao || 'N/A'}`);
  console.log(`        Disponivel: ${arm.disponivel}`);

  return Number(arm.arm_id);
}

// =============================================================================
// Funcao Principal
// =============================================================================

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log(' CRIADOR DE DADOS DE TESTE - PROMOCAO E KICKBACK');
  console.log('='.repeat(70));
  console.log(`Filial: ${FILIAL}`);

  let client: PoolClient | null = null;

  try {
    console.log('\n[CONECTANDO] Conectando ao banco PostgreSQL...');
    const pool = getPgPool(FILIAL);
    client = await pool.connect();
    console.log('[OK] Conexao estabelecida!');

    // 1. Buscar produto com estoque
    const produto = await buscarProdutoComEstoque(client);
    const precoOriginal = Number(produto.precovenda || 0);

    // 2. Buscar cliente ativo (para promocao e kickback)
    const cliente = await buscarClienteAtivo(client);

    // 3. Buscar cliente BALCAO (para teste sem promocao)
    const clienteBalcao = await buscarClienteBalcao(client);

    // 4. Criar/verificar promocao
    const promocao = await criarPromocao(client, produto.codprod, precoOriginal);

    // 5. Criar/verificar preco kickback
    const kickback = await criarPrecoKickback(client, produto.codprod, precoOriginal);

    // 6. Habilitar kickback no cliente
    await habilitarKickbackCliente(client, cliente.codcli);

    // 7. Buscar armazem
    const armId = await buscarArmazemComEstoque(client, produto.codprod);

    // ==========================================================================
    // RESUMO FINAL
    // ==========================================================================
    console.log('\n' + '='.repeat(70));
    console.log(' DADOS PARA TESTE');
    console.log('='.repeat(70));

    console.log('\n>>> PRODUTO PARA TESTE <<<');
    console.log(`    Codigo:         ${produto.codprod}`);
    console.log(`    Referencia:     ${produto.ref || 'N/A'}`);
    console.log(`    Descricao:      ${produto.descr?.substring(0, 50) || 'N/A'}`);
    console.log(`    Preco Original: R$ ${precoOriginal.toFixed(2)}`);
    console.log(`    Armazem:        ${armId}`);

    console.log('\n>>> PROMOCAO <<<');
    console.log(`    ID Promocao Item: ${promocao.id_promocao_item}`);
    console.log(`    Desconto:         ${promocao.valor_desconto || 15}%`);
    console.log(`    Preco Promo:      R$ ${(promocao.preco_promo || precoOriginal * 0.85).toFixed(2)}`);

    console.log('\n>>> KICKBACK <<<');
    console.log(`    Preco Kickback:   R$ ${kickback.preco_kickback.toFixed(2)}`);

    console.log('\n>>> CLIENTE PARA TESTE DE PROMOCAO E KICKBACK <<<');
    console.log(`    Codigo:   ${cliente.codcli}`);
    console.log(`    Nome:     ${cliente.nome?.substring(0, 40) || 'N/A'}`);
    console.log(`    Kickback: 1 (habilitado)`);

    if (clienteBalcao) {
      console.log('\n>>> CLIENTE BALCAO (SEM PROMOCAO) <<<');
      console.log(`    Codigo: ${clienteBalcao.codcli}`);
      console.log(`    Nome:   ${clienteBalcao.nome || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(' COMO TESTAR');
    console.log('='.repeat(70));

    console.log('\n1. TESTE DE PROMOCAO:');
    console.log(`   - Selecione o cliente: ${cliente.codcli} - ${cliente.nome?.substring(0, 30) || ''}`);
    console.log(`   - Busque o produto: ${produto.codprod} ou ${produto.ref || ''}`);
    console.log(`   - Adicione quantidade >= 1`);
    console.log(`   - O icone de promocao (%) deve aparecer AMARELO`);
    console.log(`   - O preco deve mudar de R$ ${precoOriginal.toFixed(2)} para R$ ${(promocao.preco_promo || precoOriginal * 0.85).toFixed(2)}`);

    console.log('\n2. TESTE DE KICKBACK:');
    console.log(`   - Use o MESMO cliente: ${cliente.codcli}`);
    console.log(`   - Busque o produto: ${produto.codprod}`);
    console.log(`   - O icone de presente (gift) deve aparecer CINZA`);
    console.log(`   - ATENCAO: Kickback so aparece quando NAO tem promocao ativa!`);
    console.log(`   - Para testar kickback, use um PRODUTO DIFERENTE sem promocao`);
    console.log(`   - OU desative a promocao no banco`);

    if (clienteBalcao) {
      console.log('\n3. TESTE SEM PROMOCAO (BALCAO):');
      console.log(`   - Selecione o cliente: ${clienteBalcao.codcli}`);
      console.log(`   - Busque o mesmo produto: ${produto.codprod}`);
      console.log(`   - O icone de promocao NAO deve aparecer`);
      console.log(`   - O preco deve ser o original: R$ ${precoOriginal.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(70));

    // Salvar em arquivo JSON para referencia
    const dadosTeste = {
      produto: {
        codprod: produto.codprod,
        ref: produto.ref,
        descricao: produto.descr,
        preco_original: precoOriginal,
        arm_id: armId,
      },
      promocao: {
        id_promocao_item: promocao.id_promocao_item,
        desconto: promocao.valor_desconto || 15,
        preco_promo: promocao.preco_promo || precoOriginal * 0.85,
      },
      kickback: {
        preco_kickback: kickback.preco_kickback,
      },
      cliente_promocao_kickback: {
        codcli: cliente.codcli,
        nome: cliente.nome,
      },
      cliente_balcao: clienteBalcao
        ? { codcli: clienteBalcao.codcli, nome: clienteBalcao.nome }
        : null,
    };

    console.log('\n>>> JSON DOS DADOS <<<');
    console.log(JSON.stringify(dadosTeste, null, 2));

  } catch (error: any) {
    console.error(`\n[ERRO] ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    for (const key of Object.keys(pgPools)) {
      await pgPools[key].end();
    }
    console.log('\n[FIM] Script finalizado.');
  }
}

main().catch((err) => {
  console.error('[ERRO FATAL]', err);
  process.exit(1);
});

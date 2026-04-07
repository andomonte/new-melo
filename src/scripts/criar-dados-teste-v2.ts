/**
 * Script para criar dados de teste para Promocao e Kickback
 * Versao 2: Cria 2 produtos diferentes - um com promocao e outro so com kickback
 *
 * Executar com: npx tsx src/scripts/criar-dados-teste-v2.ts
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

const FILIAL = process.env.FILIAL_TESTE || 'MANAUS';

// =============================================================================
// Funcoes
// =============================================================================

async function buscarDoisProdutosComEstoque(client: PoolClient): Promise<any[]> {
  console.log('\n[1] Buscando 2 produtos com estoque disponivel...');

  const query = `
    SELECT
      p.codprod,
      p.descr,
      p.ref,
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
    WHERE fp."PRECOVENDA" > 10
      AND COALESCE(p.inf, '') <> 'D'
      AND COALESCE(p.excluido, 0) <> 1
      AND (COALESCE(cs.qtest, 0) - COALESCE(cs.qtdreservada, 0)) >= 10
    ORDER BY RANDOM()
    LIMIT 2
  `;

  const result = await client.query(query);

  if (result.rows.length < 2) {
    throw new Error('Nao foi possivel encontrar 2 produtos com estoque!');
  }

  console.log('   [OK] Produto 1 (PARA PROMOCAO):');
  console.log(`        Codigo: ${result.rows[0].codprod} | Ref: ${result.rows[0].ref}`);
  console.log(`        Preco:  R$ ${Number(result.rows[0].precovenda).toFixed(2)}`);

  console.log('   [OK] Produto 2 (PARA KICKBACK):');
  console.log(`        Codigo: ${result.rows[1].codprod} | Ref: ${result.rows[1].ref}`);
  console.log(`        Preco:  R$ ${Number(result.rows[1].precovenda).toFixed(2)}`);

  return result.rows;
}

async function buscarClienteNaoBalcao(client: PoolClient): Promise<any> {
  console.log('\n[2] Buscando cliente que NAO seja BALCAO (prvenda <> 0)...');

  // Buscar cliente que tenha prvenda diferente de 0 (balcao) e diferente de vazio
  const query = `
    SELECT
      codcli,
      nome,
      nomefant,
      cidade,
      uf,
      prvenda,
      COALESCE(kickback, 0) as kickback
    FROM dbclien
    WHERE COALESCE(status, '1') IN ('1', '2')
      AND UPPER(nome) NOT LIKE '%BALC%'
      AND UPPER(nome) NOT LIKE '%CONSUMIDOR%'
      AND codcli IS NOT NULL
      AND nome IS NOT NULL
      AND prvenda IS NOT NULL
      AND prvenda <> '0'
      AND prvenda <> ''
    ORDER BY RANDOM()
    LIMIT 1
  `;

  const result = await client.query(query);

  if (result.rows.length === 0) {
    // Fallback: busca qualquer cliente com prvenda definido
    console.log('   [AVISO] Tentando buscar cliente com prvenda definido...');
    const fallback = await client.query(`
      SELECT codcli, nome, nomefant, cidade, uf, prvenda, COALESCE(kickback, 0) as kickback
      FROM dbclien
      WHERE prvenda IS NOT NULL AND prvenda <> '0' AND prvenda <> ''
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (fallback.rows.length === 0) {
      throw new Error('Nenhum cliente com prvenda encontrado!');
    }

    const cli = fallback.rows[0];
    console.log(`   [OK] Cliente encontrado:`);
    console.log(`        Codigo:  ${cli.codcli}`);
    console.log(`        Nome:    ${cli.nome?.substring(0, 40)}`);
    console.log(`        Prvenda: ${cli.prvenda}`);
    return cli;
  }

  const cliente = result.rows[0];
  console.log(`   [OK] Cliente encontrado:`);
  console.log(`        Codigo:  ${cliente.codcli}`);
  console.log(`        Nome:    ${cliente.nome?.substring(0, 40)}`);
  console.log(`        Prvenda: ${cliente.prvenda}`);
  console.log(`        Cidade:  ${cliente.cidade} - ${cliente.uf}`);

  return cliente;
}

async function buscarClienteBalcao(client: PoolClient): Promise<any> {
  console.log('\n[3] Buscando cliente BALCAO (prvenda = 0)...');

  const query = `
    SELECT codcli, nome, prvenda
    FROM dbclien
    WHERE (prvenda = '0' OR prvenda IS NULL OR prvenda = '')
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
  console.log(`   [OK] Cliente BALCAO:`);
  console.log(`        Codigo:  ${cliente.codcli}`);
  console.log(`        Nome:    ${cliente.nome}`);
  console.log(`        Prvenda: ${cliente.prvenda || '(vazio)'}`);

  return cliente;
}

async function criarPromocao(
  client: PoolClient,
  codprod: string,
  precoOriginal: number
): Promise<any> {
  console.log(`\n[4] Criando promocao para produto ${codprod}...`);

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
    console.log(`   [OK] Promocao ja existe: ID ${promo.id_promocao_item}`);
    return { ...promo, valor_desconto: valorDesconto, preco_promo: precoPromo };
  }

  const hoje = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 30);

  const nomePromocao = `TESTE_PROMO_${codprod}`;
  const valorDesconto = 15;

  await client.query('BEGIN');

  try {
    const insertPromo = `
      INSERT INTO dbpromocao (
        nome_promocao, descricao_promocao, data_inicio, data_fim,
        tipo_promocao, valor_desconto, tipo_desconto, qtde_minima_ativacao,
        qtde_maxima_total, ativa, criado_por, observacoes
      )
      VALUES ($1, $2, $3, $4, 'PROD', $5, 'PERC', 1, 100, true, 'SCRIPT', 'Teste')
      RETURNING id_promocao
    `;

    const promoResult = await client.query(insertPromo, [
      nomePromocao,
      `Promocao teste ${valorDesconto}%`,
      hoje,
      dataFim,
      valorDesconto,
    ]);

    const idPromocao = promoResult.rows[0].id_promocao;

    const insertItem = `
      INSERT INTO dbpromocao_item (
        id_promocao, codprod, valor_desconto_item, tipo_desconto_item,
        qtde_minima_item, qtd_total_item
      )
      VALUES ($1, $2, $3, 'PERC', 1, 50)
      RETURNING id_promocao_item
    `;

    const itemResult = await client.query(insertItem, [idPromocao, codprod, valorDesconto]);
    const idPromocaoItem = itemResult.rows[0].id_promocao_item;

    await client.query('COMMIT');

    const precoPromo = precoOriginal * (1 - valorDesconto / 100);
    console.log(`   [OK] Promocao criada: ID ${idPromocaoItem} (${valorDesconto}%)`);

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

async function criarPrecoKickback(
  client: PoolClient,
  codprod: string,
  precoOriginal: number
): Promise<any> {
  console.log(`\n[5] Criando preco kickback para produto ${codprod}...`);

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
    console.log(`   [OK] Preco kickback ja existe: R$ ${Number(kb.preco_kickback).toFixed(2)}`);
    return { preco_kickback: Number(kb.preco_kickback) };
  }

  const precoKickback = precoOriginal * 0.80;

  try {
    await client.query(
      `INSERT INTO dbprecokb (codprod, dscbalcao45) VALUES ($1, $2)
       ON CONFLICT (codprod) DO UPDATE SET dscbalcao45 = EXCLUDED.dscbalcao45`,
      [codprod, precoKickback]
    );
  } catch (e) {
    try {
      await client.query(
        `INSERT INTO dbprecokb (codprod, dscbalcao45) VALUES ($1, $2)`,
        [codprod, precoKickback]
      );
    } catch (e2) {
      await client.query(
        `UPDATE dbprecokb SET dscbalcao45 = $2 WHERE codprod = $1`,
        [codprod, precoKickback]
      );
    }
  }

  console.log(`   [OK] Preco kickback criado: R$ ${precoKickback.toFixed(2)} (-20%)`);
  return { preco_kickback: precoKickback };
}

async function habilitarKickbackCliente(client: PoolClient, codcli: string): Promise<void> {
  console.log(`\n[6] Habilitando kickback para cliente ${codcli}...`);
  await client.query(`UPDATE dbclien SET kickback = 1 WHERE codcli = $1`, [codcli]);
  console.log(`   [OK] Cliente ${codcli} agora tem kickback = 1`);
}

async function buscarArmazem(client: PoolClient, codprod: string): Promise<number> {
  const query = `
    SELECT arp.arp_arm_id as arm_id
    FROM cad_armazem_produto arp
    WHERE btrim(arp.arp_codprod) = $1
      AND COALESCE(arp.arp_bloqueado, 'N') <> 'S'
      AND (arp.arp_qtest - COALESCE(arp.arp_qtest_reservada, 0)) > 0
    ORDER BY (arp.arp_qtest - COALESCE(arp.arp_qtest_reservada, 0)) DESC
    LIMIT 1
  `;
  const result = await client.query(query, [codprod]);
  return result.rows.length > 0 ? Number(result.rows[0].arm_id) : 1;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log(' CRIADOR DE DADOS DE TESTE - v2');
  console.log(' (2 produtos: um com promocao, outro so com kickback)');
  console.log('='.repeat(70));

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(FILIAL);
    client = await pool.connect();
    console.log('[OK] Conectado ao banco');

    // 1. Buscar 2 produtos
    const produtos = await buscarDoisProdutosComEstoque(client);
    const produtoPromo = produtos[0];
    const produtoKickback = produtos[1];

    // 2. Buscar cliente NAO balcao
    const cliente = await buscarClienteNaoBalcao(client);

    // 3. Buscar cliente balcao
    const clienteBalcao = await buscarClienteBalcao(client);

    // 4. Criar promocao para produto 1
    const precoPromo1 = Number(produtoPromo.precovenda || 0);
    const promocao = await criarPromocao(client, produtoPromo.codprod, precoPromo1);

    // 5. Criar kickback para produto 2 (SEM criar promocao)
    const precoKb2 = Number(produtoKickback.precovenda || 0);
    const kickback = await criarPrecoKickback(client, produtoKickback.codprod, precoKb2);

    // 6. Habilitar kickback no cliente
    await habilitarKickbackCliente(client, cliente.codcli);

    // 7. Buscar armazens
    const arm1 = await buscarArmazem(client, produtoPromo.codprod);
    const arm2 = await buscarArmazem(client, produtoKickback.codprod);

    // ==========================================================================
    // RESUMO
    // ==========================================================================
    console.log('\n' + '='.repeat(70));
    console.log(' DADOS PARA TESTE');
    console.log('='.repeat(70));

    console.log('\n┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ PRODUTO 1 - PARA TESTAR PROMOCAO                                   │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    console.log(`│ Codigo:         ${produtoPromo.codprod.padEnd(52)}│`);
    console.log(`│ Referencia:     ${(produtoPromo.ref || 'N/A').padEnd(52)}│`);
    console.log(`│ Descricao:      ${(produtoPromo.descr?.substring(0, 50) || 'N/A').padEnd(52)}│`);
    console.log(`│ Preco Original: R$ ${precoPromo1.toFixed(2).padEnd(49)}│`);
    console.log(`│ Preco PROMO:    R$ ${promocao.preco_promo.toFixed(2)} (-${promocao.valor_desconto}%)`.padEnd(69) + '│');
    console.log(`│ Armazem:        ${String(arm1).padEnd(52)}│`);
    console.log('└────────────────────────────────────────────────────────────────────┘');

    console.log('\n┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ PRODUTO 2 - PARA TESTAR KICKBACK (sem promocao)                    │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    console.log(`│ Codigo:         ${produtoKickback.codprod.padEnd(52)}│`);
    console.log(`│ Referencia:     ${(produtoKickback.ref || 'N/A').padEnd(52)}│`);
    console.log(`│ Descricao:      ${(produtoKickback.descr?.substring(0, 50) || 'N/A').padEnd(52)}│`);
    console.log(`│ Preco Original: R$ ${precoKb2.toFixed(2).padEnd(49)}│`);
    console.log(`│ Preco KICKBACK: R$ ${kickback.preco_kickback.toFixed(2)} (-20%)`.padEnd(69) + '│');
    console.log(`│ Armazem:        ${String(arm2).padEnd(52)}│`);
    console.log('└────────────────────────────────────────────────────────────────────┘');

    console.log('\n┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ CLIENTE PARA TESTE (com kickback habilitado)                       │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    console.log(`│ Codigo:         ${cliente.codcli.padEnd(52)}│`);
    console.log(`│ Nome:           ${(cliente.nome?.substring(0, 50) || 'N/A').padEnd(52)}│`);
    console.log(`│ Tipo Preco:     ${(cliente.prvenda || '0').padEnd(52)}│`);
    console.log(`│ Kickback:       1 (habilitado)`.padEnd(69) + '│');
    console.log('└────────────────────────────────────────────────────────────────────┘');

    if (clienteBalcao) {
      console.log('\n┌────────────────────────────────────────────────────────────────────┐');
      console.log('│ CLIENTE BALCAO (para comparacao - sem promocao)                    │');
      console.log('├────────────────────────────────────────────────────────────────────┤');
      console.log(`│ Codigo:         ${clienteBalcao.codcli.padEnd(52)}│`);
      console.log(`│ Nome:           ${(clienteBalcao.nome?.substring(0, 50) || 'N/A').padEnd(52)}│`);
      console.log('└────────────────────────────────────────────────────────────────────┘');
    }

    console.log('\n' + '='.repeat(70));
    console.log(' INSTRUCOES DE TESTE');
    console.log('='.repeat(70));

    console.log('\n>>> TESTE 1: PROMOCAO <<<');
    console.log(`1. Selecione cliente: ${cliente.codcli} - ${cliente.nome?.substring(0, 30)}`);
    console.log(`2. Busque produto: ${produtoPromo.codprod} ou ${produtoPromo.ref}`);
    console.log(`3. Adicione quantidade >= 1`);
    console.log(`4. ESPERADO: Icone de promocao (%) AMARELO`);
    console.log(`5. ESPERADO: Preco muda de R$ ${precoPromo1.toFixed(2)} para R$ ${promocao.preco_promo.toFixed(2)}`);

    console.log('\n>>> TESTE 2: KICKBACK <<<');
    console.log(`1. Selecione cliente: ${cliente.codcli} (mesmo cliente)`);
    console.log(`2. Busque produto: ${produtoKickback.codprod} ou ${produtoKickback.ref}`);
    console.log(`3. ESPERADO: Icone de presente (gift) CINZA`);
    console.log(`4. Clique no icone para ativar`);
    console.log(`5. ESPERADO: Icone fica VERDE`);
    console.log(`6. ESPERADO: Preco muda de R$ ${precoKb2.toFixed(2)} para R$ ${kickback.preco_kickback.toFixed(2)}`);

    if (clienteBalcao) {
      console.log('\n>>> TESTE 3: BALCAO (sem promocao) <<<');
      console.log(`1. Selecione cliente: ${clienteBalcao.codcli}`);
      console.log(`2. Busque produto: ${produtoPromo.codprod}`);
      console.log(`3. ESPERADO: SEM icone de promocao`);
      console.log(`4. ESPERADO: Preco original R$ ${precoPromo1.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(' JSON');
    console.log('='.repeat(70));

    const dadosTeste = {
      produto_promocao: {
        codprod: produtoPromo.codprod,
        ref: produtoPromo.ref,
        preco_original: precoPromo1,
        preco_promo: promocao.preco_promo,
        id_promocao_item: promocao.id_promocao_item,
      },
      produto_kickback: {
        codprod: produtoKickback.codprod,
        ref: produtoKickback.ref,
        preco_original: precoKb2,
        preco_kickback: kickback.preco_kickback,
      },
      cliente: {
        codcli: cliente.codcli,
        nome: cliente.nome,
        prvenda: cliente.prvenda,
      },
      cliente_balcao: clienteBalcao ? {
        codcli: clienteBalcao.codcli,
        nome: clienteBalcao.nome,
      } : null,
    };

    console.log(JSON.stringify(dadosTeste, null, 2));

  } catch (error: any) {
    console.error(`\n[ERRO] ${error.message}`);
    process.exit(1);
  } finally {
    if (client) client.release();
    for (const key of Object.keys(pgPools)) {
      await pgPools[key].end();
    }
    console.log('\n[FIM]');
  }
}

main();

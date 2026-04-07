/**
 * Script de Teste do Sistema de Promocoes - Produto 414070
 *
 * Este script testa o fluxo de promocoes do sistema:
 * 1. Conecta ao banco PostgreSQL usando getPgPool
 * 2. Verifica dados do produto 414070 (preco, estoque)
 * 3. Verifica se existe promocao ativa para esse produto
 * 4. Se nao existir, cria uma promocao de teste
 * 5. Simula a consulta da API de produtos (PROMOCOES_ATIVAS)
 * 6. Mostra como seria o payload de uma venda
 *
 * Executar com: npx ts-node --esm src/scripts/teste-promocao.ts
 * Ou: npx tsx src/scripts/teste-promocao.ts
 */

// Carregar variaveis de ambiente do .env
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Pool, PoolClient } from 'pg';

// =============================================================================
// Configuracao do Pool de Conexao (baseado em src/lib/pgClient.ts)
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
    throw new Error(`Filial invalida (string vazia/undefined) ao obter Pool PG.`);
  }

  const cacheKey = String(filialOrDbName).trim().toUpperCase();
  const envKey = toDbEnvKey(filialOrDbName);
  let dbUrl = process.env[envKey];

  if (!dbUrl && process.env.DATABASE_URL_DEFAULT) {
    dbUrl = process.env.DATABASE_URL_DEFAULT!;
  }

  if (!dbUrl) {
    throw new Error(
      `Variavel de ambiente nao encontrada: ${envKey} (nem DATABASE_URL_DEFAULT).`
    );
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

const CODPROD_TESTE = '414070';
const FILIAL = process.env.FILIAL_TESTE || 'MANAUS'; // Usa MANAUS como padrao
const TIPO_PRECO = '0'; // Tipo de preco padrao

// =============================================================================
// Interfaces
// =============================================================================

interface DadosProduto {
  codprod: string;
  descr: string;
  ref: string;
  qtest: number;
  qtdreservada: number;
  qtddisponivel: number;
  precovenda: number;
  marca: string;
}

interface PromocaoItem {
  id_promocao_item: number;
  id_promocao: number;
  codprod: string | null;
  codgpp: string | null;
  valor_desconto_item: number;
  tipo_desconto_item: string;
  qtde_minima_item: number;
  qtde_maxima_item: number | null;
  qtd_total_item: number | null;
  qtdvendido: number | null;
  qtdfaturado: number | null;
  nome_promocao: string;
  tipo_promocao: string;
  ativa: boolean;
}

interface Promocao {
  id_promocao: number;
  nome_promocao: string;
  descricao_promocao: string | null;
  data_inicio: Date;
  data_fim: Date;
  tipo_promocao: string;
  valor_desconto: number;
  tipo_desconto: string;
  qtde_minima_ativacao: number;
  qtde_maxima_total: number | null;
  qtde_maxima_por_cliente: number | null;
  ativa: boolean;
  criado_por: string;
  observacoes: string | null;
}

interface ItemVenda {
  codprod: string;
  qtd: number;
  prunit: number;
  desconto: number;
  totalproduto: number;
  arm_id: number;
  ref: string;
  descr: string;
  id_promocao_item?: number | null;
  promoQty?: number;
  quantidade_promocional?: number;
}

// =============================================================================
// Funcoes de Consulta
// =============================================================================

/**
 * Busca dados do produto no banco
 */
async function buscarDadosProduto(
  client: PoolClient,
  codprod: string
): Promise<DadosProduto | null> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[1] VERIFICANDO DADOS DO PRODUTO ${codprod}`);
  console.log(`${'='.repeat(60)}`);

  // Query similar a usada em src/pages/api/vendas/postgresql/produto.ts
  const query = `
    WITH cap_sum AS (
      SELECT
        btrim(arp_codprod) AS codprod_txt,
        SUM(arp_qtest) AS qtest,
        SUM(arp_qtest_reservada) AS qtdreservada
      FROM cad_armazem_produto
      WHERE COALESCE(arp_bloqueado,'N') <> 'S'
      GROUP BY btrim(arp_codprod)
    ),
    fp_collapse AS (
      SELECT "CODPROD",
             "TIPOPRECO",
             MAX("PRECOVENDA") AS "PRECOVENDA"
      FROM dbformacaoprvenda
      WHERE "TIPOPRECO"::text = $2::text
        AND "PRECOVENDA" > 0
      GROUP BY "CODPROD","TIPOPRECO"
    )
    SELECT
      p.codprod,
      p.descr,
      p.ref,
      COALESCE(cs.qtest, 0) AS qtest,
      COALESCE(cs.qtdreservada, 0) AS qtdreservada,
      COALESCE(cs.qtest, 0) - COALESCE(cs.qtdreservada, 0) AS qtddisponivel,
      fp."PRECOVENDA" as precovenda,
      m.descr AS marca
    FROM dbprod p
    LEFT JOIN cap_sum cs ON cs.codprod_txt = btrim(p.codprod::text)
    LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
    LEFT JOIN fp_collapse fp ON btrim(p.codprod::text) = btrim(fp."CODPROD"::text)
    WHERE p.codprod = $1
  `;

  const result = await client.query(query, [codprod, TIPO_PRECO]);

  if (result.rows.length === 0) {
    console.log(`[ERRO] Produto ${codprod} nao encontrado no banco.`);
    return null;
  }

  const produto = result.rows[0] as DadosProduto;

  console.log(`\n[OK] Produto encontrado:`);
  console.log(`   - Codigo:      ${produto.codprod}`);
  console.log(`   - Descricao:   ${produto.descr || 'N/A'}`);
  console.log(`   - Referencia:  ${produto.ref || 'N/A'}`);
  console.log(`   - Marca:       ${produto.marca || 'N/A'}`);
  console.log(`   - Estoque:     ${produto.qtest}`);
  console.log(`   - Reservado:   ${produto.qtdreservada}`);
  console.log(`   - Disponivel:  ${produto.qtddisponivel}`);
  console.log(
    `   - Preco Venda: R$ ${
      produto.precovenda ? Number(produto.precovenda).toFixed(2) : 'N/A'
    }`
  );

  return produto;
}

/**
 * Verifica se existe promocao ativa para o produto
 * Query baseada em src/pages/api/vendas/postgresql/produto.ts (queryPromocao)
 */
async function verificarPromocaoAtiva(
  client: PoolClient,
  codprod: string
): Promise<PromocaoItem | null> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[2] VERIFICANDO PROMOCAO ATIVA PARA PRODUTO ${codprod}`);
  console.log(`${'='.repeat(60)}`);

  const currentDateTime = new Date().toISOString();

  // Query igual a queryPromocao em src/pages/api/vendas/postgresql/produto.ts
  const query = `
    SELECT
      dpi.id_promocao_item,
      dpi.codprod,
      dpi.codgpp,
      dpi.valor_desconto_item,
      dpi.tipo_desconto_item,
      dpi.qtde_minima_item,
      dpi.qtde_maxima_item,
      dpi.qtd_total_item,
      dpi.qtdvendido,
      dpi.qtdfaturado,
      dp.id_promocao,
      dp.ativa,
      dp.nome_promocao,
      dp.tipo_promocao,
      dp.valor_desconto AS valor_desconto_promocao_geral,
      dp.tipo_desconto AS tipo_desconto_promocao_geral
    FROM dbpromocao_item dpi
    JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
    WHERE dp.ativa = TRUE
      AND $1 BETWEEN dp.data_inicio AND dp.data_fim
      AND dpi.codprod = $2
  `;

  const result = await client.query(query, [currentDateTime, codprod]);

  if (result.rows.length === 0) {
    console.log(`\n[INFO] Nenhuma promocao ativa encontrada para o produto ${codprod}.`);
    return null;
  }

  const promocao = result.rows[0] as PromocaoItem;

  console.log(`\n[OK] Promocao ativa encontrada:`);
  console.log(`   - ID Item:        ${promocao.id_promocao_item}`);
  console.log(`   - ID Promocao:    ${promocao.id_promocao}`);
  console.log(`   - Nome:           ${promocao.nome_promocao}`);
  console.log(`   - Tipo:           ${promocao.tipo_promocao}`);
  console.log(`   - Desconto:       ${promocao.valor_desconto_item}%`);
  console.log(`   - Tipo Desconto:  ${promocao.tipo_desconto_item}`);
  console.log(`   - Qtd Minima:     ${promocao.qtde_minima_item}`);
  console.log(`   - Qtd Maxima:     ${promocao.qtde_maxima_item || 'Ilimitada'}`);
  console.log(`   - Qtd Total:      ${promocao.qtd_total_item || 'Ilimitada'}`);
  console.log(`   - Qtd Vendido:    ${promocao.qtdvendido || 0}`);
  console.log(`   - Qtd Faturado:   ${promocao.qtdfaturado || 0}`);

  return promocao;
}

/**
 * Cria uma promocao de teste para o produto
 * Logica baseada em src/pages/api/promocoes/add.ts
 */
async function criarPromocaoTeste(
  client: PoolClient,
  codprod: string
): Promise<{ promocao: Promocao; idPromocaoItem: number }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[3] CRIANDO PROMOCAO DE TESTE PARA PRODUTO ${codprod}`);
  console.log(`${'='.repeat(60)}`);

  const hoje = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 7);

  // Dados da promocao
  const nomePromocao = `Teste Promocao ${codprod}`;
  const tipoPromocao = 'PROD';
  const valorDesconto = 10; // 10%
  const tipoDesconto = 'PERC';
  const qtdeMinimaAtivacao = 1;
  const qtdeMaximaTotal = 100;
  const criadoPor = 'SCRIPT_TESTE';

  console.log(`\n[INFO] Dados da promocao:`);
  console.log(`   - Nome:         ${nomePromocao}`);
  console.log(`   - Tipo:         ${tipoPromocao}`);
  console.log(`   - Desconto:     ${valorDesconto}% (${tipoDesconto})`);
  console.log(`   - Data Inicio:  ${hoje.toISOString()}`);
  console.log(`   - Data Fim:     ${dataFim.toISOString()}`);
  console.log(`   - Qtd Total:    ${qtdeMaximaTotal}`);
  console.log(`   - Qtd Minima:   ${qtdeMinimaAtivacao}`);

  await client.query('BEGIN');

  try {
    // 1. Inserir na tabela dbpromocao
    const insertPromocaoQuery = `
      INSERT INTO dbpromocao (
        nome_promocao, descricao_promocao, data_inicio, data_fim,
        tipo_promocao, valor_desconto, tipo_desconto, qtde_minima_ativacao,
        qtde_maxima_total, qtde_maxima_por_cliente, ativa, criado_por, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const promocaoResult = await client.query(insertPromocaoQuery, [
      nomePromocao,
      `Promocao de teste criada automaticamente para o produto ${codprod}`,
      hoje,
      dataFim,
      tipoPromocao,
      valorDesconto,
      tipoDesconto,
      qtdeMinimaAtivacao,
      qtdeMaximaTotal,
      null, // qtde_maxima_por_cliente
      true, // ativa
      criadoPor,
      'Criada pelo script teste-promocao.ts',
    ]);

    const promocao = promocaoResult.rows[0] as Promocao;
    console.log(`\n[OK] Promocao criada com ID: ${promocao.id_promocao}`);

    // 2. Inserir item da promocao na tabela dbpromocao_item
    const insertItemQuery = `
      INSERT INTO dbpromocao_item (
        id_promocao, codprod, codgpp,
        valor_desconto_item, tipo_desconto_item,
        qtde_minima_item, qtde_maxima_item,
        qtd_total_item, origem
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id_promocao_item
    `;

    const itemResult = await client.query(insertItemQuery, [
      promocao.id_promocao,
      codprod,
      null, // codgpp
      valorDesconto,
      tipoDesconto,
      qtdeMinimaAtivacao,
      null, // qtde_maxima_item
      qtdeMaximaTotal,
      null, // origem
    ]);

    const idPromocaoItem = itemResult.rows[0].id_promocao_item;
    console.log(`[OK] Item de promocao criado com ID: ${idPromocaoItem}`);

    await client.query('COMMIT');

    return { promocao, idPromocaoItem };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Simula a consulta que a API de produto faz para retornar PROMOCOES_ATIVAS
 * Baseado em promocoesAtivas() em src/pages/api/vendas/postgresql/produto.ts
 */
async function simularConsultaAPI(
  client: PoolClient,
  codprod: string
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[4] SIMULANDO CONSULTA DA API DE PRODUTOS`);
  console.log(`${'='.repeat(60)}`);

  const currentDateTime = new Date().toISOString();

  // Query igual a usada na API
  const queryPromocao = `
    SELECT
      dpi.id_promocao_item,
      dpi.codprod,
      dpi.codgpp,
      dpi.valor_desconto_item,
      dpi.tipo_desconto_item,
      dpi.qtde_minima_item,
      dpi.qtde_maxima_item,
      dpi.qtd_total_item,
      dpi.qtdvendido,
      dpi.qtdfaturado,
      dp.id_promocao,
      dp.ativa,
      dp.nome_promocao,
      dp.tipo_promocao,
      dp.valor_desconto AS valor_desconto_promocao_geral,
      dp.tipo_desconto AS tipo_desconto_promocao_geral
    FROM dbpromocao_item dpi
    JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
    WHERE dp.ativa = TRUE
      AND $1 BETWEEN dp.data_inicio AND dp.data_fim
  `;

  const promocaoResult = await client.query(queryPromocao, [currentDateTime]);
  const promocoesAtivas = promocaoResult.rows;

  // Criar mapa de promocoes por codprod (mesma logica da API)
  const promocoesMap = new Map<string, any[]>();
  promocoesAtivas.forEach((p) => {
    const key = p.codprod != null ? String(p.codprod) : null;
    if (!key) return;
    if (!promocoesMap.has(key)) promocoesMap.set(key, []);
    promocoesMap.get(key)!.push(p);
  });

  console.log(`\n[INFO] Total de promocoes ativas encontradas: ${promocoesAtivas.length}`);
  console.log(
    `[INFO] Produtos com promocao: ${Array.from(promocoesMap.keys()).join(', ') || 'Nenhum'}`
  );

  // Verificar se nosso produto tem promocao
  const promocoesDoProduto = promocoesMap.get(codprod);

  if (promocoesDoProduto && promocoesDoProduto.length > 0) {
    console.log(`\n[OK] Produto ${codprod} encontrado no mapa de promocoes:`);
    console.log(`\n--- PAYLOAD PROMOCOES_ATIVAS (como retornaria a API) ---`);
    console.log(JSON.stringify(promocoesDoProduto, null, 2));
  } else {
    console.log(`\n[INFO] Produto ${codprod} NAO possui promocao no mapa.`);
  }
}

/**
 * Gera o payload de uma venda simulada com 5 unidades
 * Baseado em src/pages/api/vendas/postgresql/finalizarVenda.ts
 */
async function simularPayloadVenda(
  client: PoolClient,
  codprod: string,
  quantidade: number = 5
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[5] SIMULANDO PAYLOAD DE VENDA (${quantidade} unidades)`);
  console.log(`${'='.repeat(60)}`);

  // Buscar dados do produto
  const produto = await buscarDadosProdutoSimples(client, codprod);
  if (!produto) {
    console.log(`[ERRO] Nao foi possivel buscar dados do produto para simulacao.`);
    return;
  }

  // Buscar promocao ativa
  const promocao = await buscarPromocaoAtivaSimples(client, codprod);

  // Calcular valores
  const precoOriginal = Number(produto.precovenda || 0);
  let precoFinal = precoOriginal;
  let desconto = 0;
  let quantidadePromocional = 0;

  if (promocao) {
    if (promocao.tipo_desconto_item === 'PERC') {
      desconto = Number(promocao.valor_desconto_item);
      precoFinal = precoOriginal * (1 - desconto / 100);
      quantidadePromocional = quantidade;
    } else if (promocao.tipo_desconto_item === 'VALO') {
      desconto = Number(promocao.valor_desconto_item);
      precoFinal = precoOriginal - desconto;
      quantidadePromocional = quantidade;
    } else if (promocao.tipo_desconto_item === 'PREF') {
      // Preco fixo
      precoFinal = Number(promocao.valor_desconto_item);
      quantidadePromocional = quantidade;
    }
  }

  const totalProduto = precoFinal * quantidade;

  // Montar item da venda (estrutura igual a ItemPayload em finalizarVenda.ts)
  const itemVenda: ItemVenda = {
    codprod: codprod,
    qtd: quantidade,
    prunit: precoFinal,
    desconto: desconto,
    totalproduto: totalProduto,
    arm_id: 1, // Armazem padrao
    ref: produto.ref || '',
    descr: produto.descr || '',
    id_promocao_item: promocao?.id_promocao_item || null,
    promoQty: quantidadePromocional,
    quantidade_promocional: quantidadePromocional,
  };

  // Payload completo da venda
  const payloadVenda = {
    header: {
      operacao: 1,
      codcli: '000001', // Cliente exemplo
      codusr: '1', // Usuario exemplo
      tipo: 'P', // Pedido
      tele: 'N',
      transp: null,
      vlrfrete: 0,
      prazo: 'A VISTA',
      obs: 'Venda de teste - NAO FINALIZADA',
      vendedor: '00001',
      operador: null,
    },
    itens: [itemVenda],
    prazos: [
      {
        data: new Date().toISOString(),
        dia: 0,
        parcela: 1,
        valor: totalProduto,
      },
    ],
  };

  console.log(`\n--- CALCULOS ---`);
  console.log(`   Preco Original:        R$ ${precoOriginal.toFixed(2)}`);
  console.log(
    `   Desconto Aplicado:     ${desconto}${promocao?.tipo_desconto_item === 'PERC' ? '%' : ''}`
  );
  console.log(`   Preco com Desconto:    R$ ${precoFinal.toFixed(2)}`);
  console.log(`   Quantidade:            ${quantidade}`);
  console.log(`   Total do Item:         R$ ${totalProduto.toFixed(2)}`);
  console.log(`   Qtd Promocional:       ${quantidadePromocional}`);

  if (promocao) {
    console.log(`\n--- PROMOCAO APLICADA ---`);
    console.log(`   ID Promocao Item:      ${promocao.id_promocao_item}`);
    console.log(`   Nome:                  ${promocao.nome_promocao}`);
  }

  console.log(`\n--- PAYLOAD COMPLETO DA VENDA (JSON) ---`);
  console.log(JSON.stringify(payloadVenda, null, 2));

  console.log(`\n--- ITEM DA VENDA (como seria enviado para finalizarVenda) ---`);
  console.log(JSON.stringify(itemVenda, null, 2));

  // Explicar como o sistema atualiza a promocao
  console.log(`\n--- FLUXO DE ATUALIZACAO DA PROMOCAO ---`);
  console.log(
    `[INFO] Ao finalizar a venda, o sistema chama updatePgPromocaoVendido()`
  );
  console.log(
    `[INFO] que executa: UPDATE dbpromocao_item SET qtdvendido = COALESCE(qtdvendido,0) + ${quantidadePromocional}`
  );
  console.log(`[INFO] WHERE id_promocao_item = ${promocao?.id_promocao_item || 'N/A'}`);
}

/**
 * Busca simplificada de dados do produto
 */
async function buscarDadosProdutoSimples(
  client: PoolClient,
  codprod: string
): Promise<any | null> {
  const query = `
    SELECT
      p.codprod,
      p.descr,
      p.ref,
      fp."PRECOVENDA" as precovenda
    FROM dbprod p
    LEFT JOIN dbformacaoprvenda fp ON btrim(p.codprod::text) = btrim(fp."CODPROD"::text)
      AND fp."TIPOPRECO"::text = $2::text
    WHERE p.codprod = $1
    LIMIT 1
  `;

  const result = await client.query(query, [codprod, TIPO_PRECO]);
  return result.rows[0] || null;
}

/**
 * Busca simplificada de promocao ativa
 */
async function buscarPromocaoAtivaSimples(
  client: PoolClient,
  codprod: string
): Promise<any | null> {
  const currentDateTime = new Date().toISOString();

  const query = `
    SELECT
      dpi.id_promocao_item,
      dpi.valor_desconto_item,
      dpi.tipo_desconto_item,
      dp.nome_promocao
    FROM dbpromocao_item dpi
    JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
    WHERE dp.ativa = TRUE
      AND $1 BETWEEN dp.data_inicio AND dp.data_fim
      AND dpi.codprod = $2
    LIMIT 1
  `;

  const result = await client.query(query, [currentDateTime, codprod]);
  return result.rows[0] || null;
}

// =============================================================================
// Funcao Principal
// =============================================================================

async function main(): Promise<void> {
  console.log('\n');
  console.log('*'.repeat(60));
  console.log('*  SCRIPT DE TESTE DO SISTEMA DE PROMOCOES                 *');
  console.log('*  Produto: ' + CODPROD_TESTE.padEnd(47) + '*');
  console.log('*  Filial:  ' + FILIAL.padEnd(47) + '*');
  console.log('*'.repeat(60));

  let client: PoolClient | null = null;

  try {
    // Conectar ao banco
    console.log(`\n[CONECTANDO] Obtendo conexao com o banco PostgreSQL...`);
    const pool = getPgPool(FILIAL);
    client = await pool.connect();
    console.log(`[OK] Conexao estabelecida com sucesso!`);

    // 1. Verificar dados do produto
    const produto = await buscarDadosProduto(client, CODPROD_TESTE);
    if (!produto) {
      throw new Error(`Produto ${CODPROD_TESTE} nao encontrado. Abortando teste.`);
    }

    // 2. Verificar promocao ativa
    let promocao = await verificarPromocaoAtiva(client, CODPROD_TESTE);

    // 3. Se nao existir promocao, criar uma
    if (!promocao) {
      console.log(`\n[INFO] Criando promocao de teste...`);
      const resultado = await criarPromocaoTeste(client, CODPROD_TESTE);
      console.log(`\n[SUCESSO] Promocao criada!`);
      console.log(`   - id_promocao:      ${resultado.promocao.id_promocao}`);
      console.log(`   - id_promocao_item: ${resultado.idPromocaoItem}`);

      // Verificar novamente
      promocao = await verificarPromocaoAtiva(client, CODPROD_TESTE);
    }

    // 4. Simular consulta da API
    await simularConsultaAPI(client, CODPROD_TESTE);

    // 5. Simular payload de venda
    await simularPayloadVenda(client, CODPROD_TESTE, 5);

    // Resumo final
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESUMO DO TESTE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`[OK] Produto ${CODPROD_TESTE} verificado`);
    console.log(`[OK] Promocao ativa: ${promocao ? 'SIM' : 'NAO'}`);
    if (promocao) {
      console.log(`[OK] ID Promocao Item: ${promocao.id_promocao_item}`);
    }
    console.log(`[OK] Payload de venda simulado com sucesso`);
    console.log(`\n[IMPORTANTE] Este script NAO executou vendas reais.`);
    console.log(`             Apenas simulou o fluxo para fins de teste.`);
  } catch (error: any) {
    console.error(`\n[ERRO FATAL] ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log(`\n[CONEXAO] Liberada com sucesso.`);
    }

    // Encerrar todos os pools
    for (const key of Object.keys(pgPools)) {
      await pgPools[key].end();
    }
    console.log(`[POOLS] Encerrados.`);
  }
}

// Executar
main()
  .then(() => {
    console.log(`\n[FIM] Script executado com sucesso!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n[ERRO] Falha ao executar script:`, err);
    process.exit(1);
  });

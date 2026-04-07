/**
 * Módulo de Associação de Ordem de Compra com NFe
 *
 * Este módulo implementa 3 estratégias de associação:
 * 1. xPed do XML - Busca direta pelo campo <xPed> nos itens da NFe
 * 2. Parser infCpl - Extrai O.C. ou N.PEDIDO das informações complementares
 * 3. Sugestão inteligente - Sugere ordens abertas do fornecedor com score
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { PoolClient } from 'pg';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface ItemNFe {
  nItem: string;
  cProd: string;
  xProd: string;
  qCom: number;
  vUnCom: number;
  xPed?: string;      // Campo do XML: número do pedido
  nItemPed?: string;  // Campo do XML: item do pedido
}

export interface DadosNFe {
  chave: string;
  numero: string;
  serie: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  dataEmissao: string;
  valorTotal: number;
  infCpl?: string;    // Informações complementares
  itens: ItemNFe[];
}

export interface ItemOC {
  codprod: string;
  referencia: string;      // Referência Melo do produto (ref na tabela dbprod)
  descricao: string;
  quantidade_oc: number;
  quantidade_atendida: number;
  quantidade_disponivel: number;
  valor_unitario: number;
}

export interface OrdemEncontrada {
  orc_id: number;
  req_id: number;
  req_versao: number;
  req_id_composto: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  data_ordem: string;
  status: string;
  valor_total: number;
  fonte: 'xped' | 'infcpl' | 'sugestao';
  score?: number;
  itens_match?: Array<{
    codprod: string;
    referencia: string;      // Referência Melo do produto (ref na tabela dbprod)
    descricao: string;
    quantidade_oc: number;
    quantidade_nfe: number;
    quantidade_disponivel: number;
    // Dados do item da NFe correspondente
    nItem_nfe?: string;      // Número do item na NFe (1, 2, 3...)
    cProd_nfe?: string;      // Código do produto na NFe (referência fornecedor)
    descricao_nfe?: string;  // Descrição do item na NFe
  }>;
  itens_oc?: ItemOC[]; // Todos os itens da OC para exibir no frontend
}

export interface ResultadoAssociacao {
  sucesso: boolean;
  metodo: 'xped' | 'infcpl' | 'sugestao' | 'manual' | 'nenhum';
  ordens: OrdemEncontrada[];
  mensagem: string;
  detalhes?: {
    xped_encontrado?: string[];
    infcpl_extraido?: string[];
    total_sugestoes?: number;
  };
}

// ============================================================================
// FUNÇÃO AUXILIAR: CALCULAR SIMILARIDADE DE DESCRIÇÕES
// ============================================================================

/**
 * Calcula similaridade entre duas descrições (0-100)
 */
function calcularSimilaridade(descricao1: string, descricao2: string): number {
  if (!descricao1 || !descricao2) return 0;

  // Normalizar: remover acentos, converter para maiúsculas, remover caracteres especiais
  const normalizar = (str: string) => {
    return str
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^A-Z0-9\s]/g, ' ') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  };

  const texto1 = normalizar(descricao1);
  const texto2 = normalizar(descricao2);

  // Extrair palavras significativas
  const extrairPalavras = (texto: string) => {
    return texto.split(' ')
      .filter(p => p.length >= 2)
      .filter(p => !/^\d{1,2}$/.test(p))
      .filter(p => !['DE', 'DA', 'DO', 'COM', 'SEM', 'PARA', 'POR', 'EM', 'NA', 'NO', 'AS', 'OS', 'UM', 'UMA'].includes(p));
  };

  const palavras1 = extrairPalavras(texto1);
  const palavras2 = extrairPalavras(texto2);

  if (palavras1.length === 0 || palavras2.length === 0) return 0;

  let matches = 0;
  let matchesParciais = 0;

  for (const p1 of palavras1) {
    for (const p2 of palavras2) {
      if (p1 === p2) {
        matches++;
        break;
      } else if (p1.includes(p2) || p2.includes(p1)) {
        matchesParciais += 0.5;
        break;
      }
    }
  }

  const totalMatches = matches + matchesParciais;
  const menorArray = Math.min(palavras1.length, palavras2.length);
  const score = (totalMatches / menorArray) * 100;

  return Math.min(100, Math.round(score));
}

// Threshold mínimo para considerar um match válido
const THRESHOLD_SIMILARIDADE = 30;

// ============================================================================
// FUNÇÃO AUXILIAR: BUSCAR ITENS DA OC E CALCULAR MATCH
// ============================================================================

/**
 * Busca os itens de uma OC e calcula match com itens da NFe
 * Usa similaridade de descrição quando códigos não batem diretamente
 *
 * IMPORTANTE: Permite que múltiplos itens da NFe com o mesmo produto
 * sejam associados ao mesmo item da OC (caso de split na NFe)
 */
async function calcularItensMatch(
  client: PoolClient,
  orcId: number,
  itensNFe: ItemNFe[]
): Promise<{ itens_match: OrdemEncontrada['itens_match']; itens_oc: ItemOC[] }> {
  const queryItens = `
    SELECT
      ri.itr_codprod as codprod,
      COALESCE(p.descr, 'PRODUTO SEM DESCRIÇÃO') as descricao,
      COALESCE(p.ref, '') as ref_fabricante,
      ri.itr_quantidade as quantidade_oc,
      COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
      (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel,
      ri.itr_pr_unitario as valor_unitario
    FROM db_manaus.cmp_ordem_compra o
    INNER JOIN db_manaus.cmp_it_requisicao ri
      ON o.orc_req_id = ri.itr_req_id
      AND o.orc_req_versao = ri.itr_req_versao
    LEFT JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
    WHERE o.orc_id = $1
      AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
  `;

  const result = await client.query(queryItens, [orcId]);
  const itensOC = result.rows;

  // Calcular match de produtos - DUAS PASSADAS para priorizar match exato
  const itensMatch: OrdemEncontrada['itens_match'] = [];
  const itensNFeMatcheados = new Set<string>(); // Evitar duplicatas de itens NFe

  // Track de quantidade restante por item OC (permite split na NFe)
  // Chave: codprod, Valor: quantidade disponível restante
  const qtdRestantePorOC = new Map<string, number>();
  for (const oc of itensOC) {
    qtdRestantePorOC.set(oc.codprod, parseFloat(oc.quantidade_disponivel));
  }

  // PASSADA 1: Match por código interno ou referência do fabricante (CONFIÁVEL)
  for (const itemNFe of itensNFe) {
    // 1. Primeiro tentar match exato por código interno
    let itemOC = itensOC.find(i => {
      const qtdRestante = qtdRestantePorOC.get(i.codprod) || 0;
      return i.codprod === itemNFe.cProd && qtdRestante > 0;
    });

    // 2. Se não achou por código, tentar por referência do fabricante (cProd da NFe = ref do produto)
    if (!itemOC && itemNFe.cProd) {
      const cProdNormalizado = itemNFe.cProd.trim().toUpperCase();
      itemOC = itensOC.find(i => {
        const qtdRestante = qtdRestantePorOC.get(i.codprod) || 0;
        if (qtdRestante <= 0) return false;
        const refNormalizada = (i.ref_fabricante || '').trim().toUpperCase();
        return refNormalizada && refNormalizada === cProdNormalizado;
      });
    }

    if (itemOC) {
      const qtdRestante = qtdRestantePorOC.get(itemOC.codprod) || 0;

      // Atualizar quantidade restante (subtrair quantidade da NFe)
      qtdRestantePorOC.set(itemOC.codprod, Math.max(0, qtdRestante - itemNFe.qCom));

      itensNFeMatcheados.add(itemNFe.nItem);
      itensMatch.push({
        codprod: itemOC.codprod,
        referencia: itemOC.ref_fabricante || itemOC.codprod, // Referência Melo
        descricao: itemOC.descricao,
        quantidade_oc: parseFloat(itemOC.quantidade_oc),
        quantidade_nfe: itemNFe.qCom,
        quantidade_disponivel: parseFloat(itemOC.quantidade_disponivel),
        nItem_nfe: itemNFe.nItem,
        cProd_nfe: itemNFe.cProd,
        descricao_nfe: itemNFe.xProd
      });
    }
  }

  // PASSADA 2: Match por similaridade de descrição (APENAS para itens não matcheados)
  for (const itemNFe of itensNFe) {
    // Pular se já matcheou na passada 1
    if (itensNFeMatcheados.has(itemNFe.nItem)) continue;

    if (itemNFe.xProd) {
      let melhorScore = 0;
      let melhorMatch: any = null;

      for (const oc of itensOC) {
        const qtdRestante = qtdRestantePorOC.get(oc.codprod) || 0;
        if (qtdRestante <= 0) continue;

        const score = calcularSimilaridade(itemNFe.xProd, oc.descricao);
        if (score > melhorScore && score >= THRESHOLD_SIMILARIDADE) {
          melhorScore = score;
          melhorMatch = oc;
        }
      }

      if (melhorMatch) {
        const qtdRestante = qtdRestantePorOC.get(melhorMatch.codprod) || 0;

        // Atualizar quantidade restante
        qtdRestantePorOC.set(melhorMatch.codprod, Math.max(0, qtdRestante - itemNFe.qCom));

        itensNFeMatcheados.add(itemNFe.nItem);
        itensMatch.push({
          codprod: melhorMatch.codprod,
          referencia: melhorMatch.ref_fabricante || melhorMatch.codprod, // Referência Melo
          descricao: melhorMatch.descricao,
          quantidade_oc: parseFloat(melhorMatch.quantidade_oc),
          quantidade_nfe: itemNFe.qCom,
          quantidade_disponivel: parseFloat(melhorMatch.quantidade_disponivel),
          nItem_nfe: itemNFe.nItem,
          cProd_nfe: itemNFe.cProd,
          descricao_nfe: itemNFe.xProd
        });
      }
    }
  }

  // Mapear todos os itens da OC para exibição
  const todosItensOC: ItemOC[] = itensOC.map(item => ({
    codprod: item.codprod,
    referencia: item.ref_fabricante || item.codprod, // Referência Melo
    descricao: item.descricao,
    quantidade_oc: parseFloat(item.quantidade_oc),
    quantidade_atendida: parseFloat(item.quantidade_atendida),
    quantidade_disponivel: parseFloat(item.quantidade_disponivel),
    valor_unitario: parseFloat(item.valor_unitario || 0)
  }));

  return { itens_match: itensMatch, itens_oc: todosItensOC };
}

// ============================================================================
// ESTRATÉGIA 1: BUSCA POR xPed DO XML
// ============================================================================

/**
 * Busca ordens de compra pelo campo xPed presente nos itens do XML
 *
 * O xPed pode conter:
 * - Número da ordem diretamente (ex: "074336")
 * - Código com prefixo (ex: "MF74266")
 * - Número formatado (ex: "000074336")
 */
export async function buscarPorXPed(
  client: PoolClient,
  itens: ItemNFe[]
): Promise<ResultadoAssociacao> {
  // Extrair xPeds únicos dos itens
  const xPedsUnicos = [...new Set(
    itens
      .filter(item => item.xPed && item.xPed.trim() !== '')
      .map(item => item.xPed!.trim().toUpperCase())
  )];

  if (xPedsUnicos.length === 0) {
    return {
      sucesso: false,
      metodo: 'xped',
      ordens: [],
      mensagem: 'Nenhum xPed encontrado nos itens do XML',
      detalhes: { xped_encontrado: [] }
    };
  }

  console.log('🔍 [xPed] Buscando por xPeds:', xPedsUnicos);

  const ordensEncontradas: OrdemEncontrada[] = [];

  for (const xPed of xPedsUnicos) {
    // Tentar extrair número da ordem do xPed
    // Remove prefixos alfabéticos e zeros à esquerda
    const numerosExtraidos = extrairNumerosOrdem(xPed);

    for (const numero of numerosExtraidos) {
      // Buscar ordem pelo ID direto ou pelo ID composto
      const query = `
        SELECT DISTINCT
          o.orc_id,
          o.orc_req_id as req_id,
          o.orc_req_versao as req_versao,
          o.orc_id::text as req_id_composto,
          COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor_nome,
          c.cpf_cgc as fornecedor_cnpj,
          o.orc_data as data_ordem,
          o.orc_status as status,
          COALESCE(o.orc_valor_total, 0) as valor_total
        FROM db_manaus.cmp_ordem_compra o
        INNER JOIN db_manaus.cmp_requisicao r
          ON o.orc_req_id = r.req_id
          AND o.orc_req_versao = r.req_versao
        LEFT JOIN db_manaus.dbcredor c
          ON r.req_cod_credor = c.cod_credor
        WHERE o.orc_status = 'A'
          AND (
            o.orc_id::text = $1
            OR o.orc_id::text = LPAD($1, 11, '0')
            OR r.req_id_composto LIKE '%' || $1
          )
        LIMIT 5
      `;

      const result = await client.query(query, [numero]);

      for (const row of result.rows) {
        // Evitar duplicatas
        if (!ordensEncontradas.find(o => o.orc_id === row.orc_id)) {
          // Calcular itens_match para cada ordem encontrada
          const { itens_match, itens_oc } = await calcularItensMatch(client, row.orc_id, itens);

          ordensEncontradas.push({
            orc_id: row.orc_id,
            req_id: row.req_id,
            req_versao: row.req_versao,
            req_id_composto: row.req_id_composto,
            fornecedor_nome: row.fornecedor_nome,
            fornecedor_cnpj: row.fornecedor_cnpj,
            data_ordem: row.data_ordem,
            status: row.status,
            valor_total: parseFloat(row.valor_total),
            fonte: 'xped',
            score: 100, // Score máximo para match direto
            itens_match,
            itens_oc
          });
        }
      }
    }
  }

  if (ordensEncontradas.length > 0) {
    console.log(`✅ [xPed] Encontradas ${ordensEncontradas.length} ordens pelo xPed`);
    return {
      sucesso: true,
      metodo: 'xped',
      ordens: ordensEncontradas,
      mensagem: `Encontrada(s) ${ordensEncontradas.length} ordem(ns) pelo xPed do XML`,
      detalhes: { xped_encontrado: xPedsUnicos }
    };
  }

  return {
    sucesso: false,
    metodo: 'xped',
    ordens: [],
    mensagem: 'Nenhuma ordem encontrada para os xPeds informados',
    detalhes: { xped_encontrado: xPedsUnicos }
  };
}

/**
 * Extrai possíveis números de ordem de um xPed
 * Trata formatos como: "074336", "MF74266 L", "000074336"
 */
function extrairNumerosOrdem(xPed: string): string[] {
  const numeros: string[] = [];

  // Extrair sequência numérica principal
  const match = xPed.match(/\d+/g);
  if (match) {
    for (const num of match) {
      // Adiciona o número sem zeros à esquerda
      const semZeros = num.replace(/^0+/, '') || '0';
      if (semZeros.length >= 4) { // Mínimo 4 dígitos para ser uma ordem
        numeros.push(semZeros);
      }
      // Também tenta com zeros (formato completo)
      if (num.length >= 4) {
        numeros.push(num);
      }
    }
  }

  return [...new Set(numeros)];
}

// ============================================================================
// ESTRATÉGIA 2: PARSER DE INFORMAÇÕES COMPLEMENTARES
// ============================================================================

/**
 * Extrai número de ordem/pedido das informações complementares da NFe
 *
 * Procura por padrões como:
 * - "O.C: 12345"
 * - "O.C.: 12345"
 * - "OC: 12345"
 * - "N.PEDIDO: 12345"
 * - "PEDIDO: 12345"
 * - "ORDEM: 12345"
 */
export async function buscarPorInfCpl(
  client: PoolClient,
  infCpl: string | undefined,
  cnpjFornecedor?: string,
  itensNFe?: ItemNFe[]
): Promise<ResultadoAssociacao> {
  if (!infCpl || infCpl.trim() === '') {
    return {
      sucesso: false,
      metodo: 'infcpl',
      ordens: [],
      mensagem: 'Sem informações complementares no XML',
      detalhes: { infcpl_extraido: [] }
    };
  }

  console.log('🔍 [infCpl] Analisando informações complementares...');

  // Padrões para extrair número de ordem/pedido
  const padroes = [
    /O\.?C\.?:?\s*(\d+)/gi,           // O.C: 12345, OC: 12345, O.C.: 12345
    /N\.?\s*PEDIDO:?\s*(\d+)/gi,      // N.PEDIDO: 12345, N PEDIDO: 12345
    /PEDIDO:?\s*(\d+)/gi,             // PEDIDO: 12345
    /ORDEM:?\s*(\d+)/gi,              // ORDEM: 12345
    /ORDEM\s*COMPRA:?\s*(\d+)/gi,     // ORDEM COMPRA: 12345
    /N[º°]?\s*ORDEM:?\s*(\d+)/gi,     // Nº ORDEM: 12345
  ];

  const numerosExtraidos: string[] = [];

  for (const padrao of padroes) {
    let match;
    while ((match = padrao.exec(infCpl)) !== null) {
      const numero = match[1].replace(/^0+/, '') || '0';
      if (numero.length >= 4 && !numerosExtraidos.includes(numero)) {
        numerosExtraidos.push(numero);
      }
    }
  }

  if (numerosExtraidos.length === 0) {
    return {
      sucesso: false,
      metodo: 'infcpl',
      ordens: [],
      mensagem: 'Nenhum número de ordem/pedido encontrado nas informações complementares',
      detalhes: { infcpl_extraido: [] }
    };
  }

  console.log('📝 [infCpl] Números extraídos:', numerosExtraidos);

  const ordensEncontradas: OrdemEncontrada[] = [];

  for (const numero of numerosExtraidos) {
    // Buscar ordem pelo número
    let query = `
      SELECT DISTINCT
        o.orc_id,
        o.orc_req_id as req_id,
        o.orc_req_versao as req_versao,
        o.orc_id::text as req_id_composto,
        COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor_nome,
        c.cpf_cgc as fornecedor_cnpj,
        o.orc_data as data_ordem,
        o.orc_status as status,
        COALESCE(o.orc_valor_total, 0) as valor_total
      FROM db_manaus.cmp_ordem_compra o
      INNER JOIN db_manaus.cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor c
        ON r.req_cod_credor = c.cod_credor
      WHERE o.orc_status = 'A'
        AND (
          o.orc_id::text = $1
          OR o.orc_id::text = LPAD($1, 11, '0')
          OR r.req_id_composto LIKE '%' || $1
        )
    `;

    const params: any[] = [numero];

    // Se tiver CNPJ do fornecedor, priorizar ordens do mesmo fornecedor
    if (cnpjFornecedor) {
      query += ` ORDER BY CASE WHEN REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $2 THEN 0 ELSE 1 END`;
      params.push(cnpjFornecedor.replace(/[^0-9]/g, ''));
    }

    query += ' LIMIT 5';

    const result = await client.query(query, params);

    for (const row of result.rows) {
      if (!ordensEncontradas.find(o => o.orc_id === row.orc_id)) {
        // Calcular itens_match se tiver itens da NFe
        let itens_match: OrdemEncontrada['itens_match'] = [];
        let itens_oc: ItemOC[] = [];

        if (itensNFe && itensNFe.length > 0) {
          const matchResult = await calcularItensMatch(client, row.orc_id, itensNFe);
          itens_match = matchResult.itens_match;
          itens_oc = matchResult.itens_oc;
        }

        ordensEncontradas.push({
          orc_id: row.orc_id,
          req_id: row.req_id,
          req_versao: row.req_versao,
          req_id_composto: row.req_id_composto,
          fornecedor_nome: row.fornecedor_nome,
          fornecedor_cnpj: row.fornecedor_cnpj,
          data_ordem: row.data_ordem,
          status: row.status,
          valor_total: parseFloat(row.valor_total),
          fonte: 'infcpl',
          score: 90, // Score alto para match por infCpl
          itens_match,
          itens_oc
        });
      }
    }
  }

  if (ordensEncontradas.length > 0) {
    console.log(`✅ [infCpl] Encontradas ${ordensEncontradas.length} ordens pela infCpl`);
    return {
      sucesso: true,
      metodo: 'infcpl',
      ordens: ordensEncontradas,
      mensagem: `Encontrada(s) ${ordensEncontradas.length} ordem(ns) pelas informações complementares`,
      detalhes: { infcpl_extraido: numerosExtraidos }
    };
  }

  return {
    sucesso: false,
    metodo: 'infcpl',
    ordens: [],
    mensagem: 'Números encontrados nas infCpl, mas nenhuma ordem correspondente',
    detalhes: { infcpl_extraido: numerosExtraidos }
  };
}

// ============================================================================
// ESTRATÉGIA 3: SUGESTÃO INTELIGENTE POR FORNECEDOR
// ============================================================================

/**
 * Sugere ordens de compra abertas do mesmo fornecedor
 * com score baseado em produtos, quantidades e datas
 */
export async function buscarSugestoesFornecedor(
  client: PoolClient,
  cnpjFornecedor: string,
  itens: ItemNFe[],
  dataNFe?: string
): Promise<ResultadoAssociacao> {
  if (!cnpjFornecedor) {
    return {
      sucesso: false,
      metodo: 'sugestao',
      ordens: [],
      mensagem: 'CNPJ do fornecedor não informado'
    };
  }

  const cnpjLimpo = cnpjFornecedor.replace(/[^0-9]/g, '');
  console.log('🔍 [Sugestão] Buscando ordens abertas do fornecedor:', cnpjLimpo);

  // Buscar ordens ativas do fornecedor
  const queryOrdens = `
    SELECT DISTINCT
      o.orc_id,
      o.orc_req_id as req_id,
      o.orc_req_versao as req_versao,
      o.orc_id::text as req_id_composto,
      COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor_nome,
      c.cpf_cgc as fornecedor_cnpj,
      o.orc_data as data_ordem,
      r.req_data as data_requisicao,
      o.orc_status as status,
      COALESCE(o.orc_valor_total, 0) as valor_total
    FROM db_manaus.cmp_ordem_compra o
    INNER JOIN db_manaus.cmp_requisicao r
      ON o.orc_req_id = r.req_id
      AND o.orc_req_versao = r.req_versao
    LEFT JOIN db_manaus.dbcredor c
      ON r.req_cod_credor = c.cod_credor
    WHERE o.orc_status = 'A'
      AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $1
    ORDER BY o.orc_data ASC, o.orc_id ASC
    LIMIT 50
  `;

  const ordensResult = await client.query(queryOrdens, [cnpjLimpo]);

  if (ordensResult.rows.length === 0) {
    return {
      sucesso: false,
      metodo: 'sugestao',
      ordens: [],
      mensagem: 'Nenhuma ordem de compra aberta encontrada para este fornecedor',
      detalhes: { total_sugestoes: 0 }
    };
  }

  // Buscar itens de todas as ordens de uma vez
  const ocIds = ordensResult.rows.map(o => o.orc_id);
  const queryItens = `
    SELECT
      o.orc_id,
      ri.itr_codprod as codprod,
      COALESCE(p.descr, 'PRODUTO SEM DESCRIÇÃO') as descricao,
      COALESCE(p.ref, '') as ref_fabricante,
      ri.itr_quantidade as quantidade_oc,
      COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
      (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel,
      ri.itr_pr_unitario as valor_unitario
    FROM db_manaus.cmp_ordem_compra o
    INNER JOIN db_manaus.cmp_it_requisicao ri
      ON o.orc_req_id = ri.itr_req_id
      AND o.orc_req_versao = ri.itr_req_versao
    LEFT JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
    WHERE o.orc_id = ANY($1)
      AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
  `;

  const itensResult = await client.query(queryItens, [ocIds]);

  // Agrupar itens por ordem
  const itensPorOC: Record<number, any[]> = {};
  for (const item of itensResult.rows) {
    if (!itensPorOC[item.orc_id]) {
      itensPorOC[item.orc_id] = [];
    }
    itensPorOC[item.orc_id].push(item);
  }

  // Calcular score para cada ordem
  const ordensComScore: OrdemEncontrada[] = [];
  const dataRef = dataNFe ? new Date(dataNFe) : new Date();

  for (const ordem of ordensResult.rows) {
    const itensOC = itensPorOC[ordem.orc_id] || [];
    if (itensOC.length === 0) continue;

    // Calcular match de produtos - DUAS PASSADAS para priorizar match exato
    const itensMatch: OrdemEncontrada['itens_match'] = [];
    const itensNFeMatcheados = new Set<string>(); // Evitar duplicatas de itens NFe
    let produtosComum = 0;

    // Track de quantidade restante por item OC (permite split na NFe)
    const qtdRestantePorOC = new Map<string, number>();
    for (const oc of itensOC) {
      qtdRestantePorOC.set(oc.codprod, parseFloat(oc.quantidade_disponivel));
    }

    // PASSADA 1: Match por código interno ou referência do fabricante (CONFIÁVEL)
    for (const itemNFe of itens) {
      // 1. Primeiro tentar match exato por código interno
      let itemOC = itensOC.find(i => {
        const qtdRestante = qtdRestantePorOC.get(i.codprod) || 0;
        return i.codprod === itemNFe.cProd && qtdRestante > 0;
      });

      // 2. Se não achou por código, tentar por referência do fabricante (cProd da NFe = ref do produto)
      if (!itemOC && itemNFe.cProd) {
        const cProdNormalizado = itemNFe.cProd.trim().toUpperCase();
        itemOC = itensOC.find(i => {
          const qtdRestante = qtdRestantePorOC.get(i.codprod) || 0;
          if (qtdRestante <= 0) return false;
          const refNormalizada = (i.ref_fabricante || '').trim().toUpperCase();
          return refNormalizada && refNormalizada === cProdNormalizado;
        });
      }

      if (itemOC) {
        const qtdRestante = qtdRestantePorOC.get(itemOC.codprod) || 0;

        // Atualizar quantidade restante
        qtdRestantePorOC.set(itemOC.codprod, Math.max(0, qtdRestante - itemNFe.qCom));

        itensNFeMatcheados.add(itemNFe.nItem);
        produtosComum++;
        itensMatch.push({
          codprod: itemOC.codprod,
          referencia: itemOC.ref_fabricante || itemOC.codprod, // Referência Melo
          descricao: itemOC.descricao,
          quantidade_oc: parseFloat(itemOC.quantidade_oc),
          quantidade_nfe: itemNFe.qCom,
          quantidade_disponivel: parseFloat(itemOC.quantidade_disponivel),
          nItem_nfe: itemNFe.nItem,
          cProd_nfe: itemNFe.cProd,
          descricao_nfe: itemNFe.xProd
        });
      }
    }

    // PASSADA 2: Match por similaridade de descrição (APENAS para itens não matcheados)
    for (const itemNFe of itens) {
      // Pular se já matcheou na passada 1
      if (itensNFeMatcheados.has(itemNFe.nItem)) continue;

      if (itemNFe.xProd) {
        let melhorScore = 0;
        let melhorMatch: any = null;

        for (const oc of itensOC) {
          const qtdRestante = qtdRestantePorOC.get(oc.codprod) || 0;
          if (qtdRestante <= 0) continue;

          const score = calcularSimilaridade(itemNFe.xProd, oc.descricao);
          if (score > melhorScore && score >= THRESHOLD_SIMILARIDADE) {
            melhorScore = score;
            melhorMatch = oc;
          }
        }

        if (melhorMatch) {
          const qtdRestante = qtdRestantePorOC.get(melhorMatch.codprod) || 0;

          // Atualizar quantidade restante
          qtdRestantePorOC.set(melhorMatch.codprod, Math.max(0, qtdRestante - itemNFe.qCom));

          itensNFeMatcheados.add(itemNFe.nItem);
          produtosComum++;
          itensMatch.push({
            codprod: melhorMatch.codprod,
            referencia: melhorMatch.ref_fabricante || melhorMatch.codprod, // Referência Melo
            descricao: melhorMatch.descricao,
            quantidade_oc: parseFloat(melhorMatch.quantidade_oc),
            quantidade_nfe: itemNFe.qCom,
            quantidade_disponivel: parseFloat(melhorMatch.quantidade_disponivel),
            nItem_nfe: itemNFe.nItem,
            cProd_nfe: itemNFe.cProd,
            descricao_nfe: itemNFe.xProd
          });
        }
      }
    }

    // Score baseado em % de produtos comum
    const scoreProdutos = itens.length > 0
      ? (produtosComum / itens.length) * 50
      : 0;

    // Score baseado em antiguidade (mais antigo = mais score)
    const dataOC = new Date(ordem.data_ordem || ordem.data_requisicao);
    const diasDiferenca = Math.floor((dataRef.getTime() - dataOC.getTime()) / (1000 * 60 * 60 * 24));
    const scoreData = Math.min(30, Math.max(0, (diasDiferenca / 30) * 5));

    // Score base por ser do mesmo fornecedor
    const scoreFornecedor = 20;

    const scoreTotal = Math.round(scoreProdutos + scoreData + scoreFornecedor);

    // Mapear todos os itens da OC para exibição no frontend
    const todosItensOC: ItemOC[] = itensOC.map(item => ({
      codprod: item.codprod,
      referencia: item.ref_fabricante || item.codprod, // Referência Melo
      descricao: item.descricao,
      quantidade_oc: parseFloat(item.quantidade_oc),
      quantidade_atendida: parseFloat(item.quantidade_atendida),
      quantidade_disponivel: parseFloat(item.quantidade_disponivel),
      valor_unitario: parseFloat(item.valor_unitario || 0)
    }));

    ordensComScore.push({
      orc_id: ordem.orc_id,
      req_id: ordem.req_id,
      req_versao: ordem.req_versao,
      req_id_composto: ordem.req_id_composto,
      fornecedor_nome: ordem.fornecedor_nome,
      fornecedor_cnpj: ordem.fornecedor_cnpj,
      data_ordem: ordem.data_ordem,
      status: ordem.status,
      valor_total: parseFloat(ordem.valor_total),
      fonte: 'sugestao',
      score: scoreTotal,
      itens_match: itensMatch,
      itens_oc: todosItensOC // Inclui todos os itens da OC
    });
  }

  // Ordenar por score, em caso de empate priorizar mais antigo
  ordensComScore.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(a.data_ordem).getTime() - new Date(b.data_ordem).getTime();
  });

  // Retornar top 10
  const top10 = ordensComScore.slice(0, 10);

  console.log(`✅ [Sugestão] Geradas ${top10.length} sugestões de ${ordensResult.rows.length} ordens`);

  return {
    sucesso: top10.length > 0,
    metodo: 'sugestao',
    ordens: top10,
    mensagem: top10.length > 0
      ? `Encontrada(s) ${top10.length} sugestão(ões) de ordens do fornecedor`
      : 'Nenhuma sugestão com score relevante',
    detalhes: { total_sugestoes: top10.length }
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE ASSOCIAÇÃO
// ============================================================================

/**
 * Executa todas as estratégias de associação em sequência
 * Retorna o primeiro resultado positivo ou todas as sugestões combinadas
 */
export async function buscarAssociacaoOrdem(
  client: PoolClient,
  dadosNFe: DadosNFe
): Promise<ResultadoAssociacao> {
  console.log('🚀 Iniciando busca de associação de ordem para NFe:', dadosNFe.chave);

  // ESTRATÉGIA 1: xPed do XML (mais precisa)
  const resultXPed = await buscarPorXPed(client, dadosNFe.itens);
  if (resultXPed.sucesso && resultXPed.ordens.length > 0) {
    return resultXPed;
  }

  // ESTRATÉGIA 2: Parser infCpl
  const resultInfCpl = await buscarPorInfCpl(
    client,
    dadosNFe.infCpl,
    dadosNFe.cnpjEmitente,
    dadosNFe.itens
  );
  if (resultInfCpl.sucesso && resultInfCpl.ordens.length > 0) {
    return resultInfCpl;
  }

  // ESTRATÉGIA 3: Sugestão por fornecedor
  const resultSugestao = await buscarSugestoesFornecedor(
    client,
    dadosNFe.cnpjEmitente,
    dadosNFe.itens,
    dadosNFe.dataEmissao
  );

  // Combinar resultados se houver sugestões
  if (resultSugestao.ordens.length > 0) {
    // Ordenar ordens por data ASC (mais antigo primeiro)
    resultSugestao.ordens.sort((a, b) => new Date(a.data_ordem).getTime() - new Date(b.data_ordem).getTime());
    return {
      ...resultSugestao,
      detalhes: {
        xped_encontrado: resultXPed.detalhes?.xped_encontrado || [],
        infcpl_extraido: resultInfCpl.detalhes?.infcpl_extraido || [],
        total_sugestoes: resultSugestao.ordens.length
      }
    };
  }

  // Nenhum resultado
  return {
    sucesso: false,
    metodo: 'nenhum',
    ordens: [],
    mensagem: 'Nenhuma ordem de compra encontrada por nenhum método',
    detalhes: {
      xped_encontrado: resultXPed.detalhes?.xped_encontrado || [],
      infcpl_extraido: resultInfCpl.detalhes?.infcpl_extraido || [],
      total_sugestoes: 0
    }
  };
}

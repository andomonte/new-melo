// src/data/produtos/produtos.ts

import api from '@/components/services/api'; // Sua instância configurada do Axios
import { Meta } from '../common/meta'; // Sua interface Meta global existente

// --- INTERFACES DE PRODUTO ---

/**
 * Define a estrutura de um objeto Produto "Cru" e completo.
 * Inclui todas as propriedades de ambas as versões anteriores.
 */
export interface Produto {
  codbar?: string;
  ref: string;
  reforiginal?: string;
  descr: string;
  aplic_extendida?: string;
  codmarca: string;
  codgpf: string;
  codgpp: string;
  curva: Curva;
  qtestmin?: number;
  qtestmax: number;
  obs?: string;
  inf: Informativo;
  pesoliq?: number;
  qtembal?: number;
  unimed: UnidadeMedida;
  multiplo: number;
  coddesc: number;
  tabelado: string;
  compradireta: CompraDireta;
  dolar?: Dolar;
  multiplocompra: number;
  tipo: TipoProduto;
  descr_importacao?: string;

  nrodi?: string;
  trib: string;
  clasfiscal: string;
  dtdi?: Date;
  strib: string;
  percsubst: number;
  isentopiscofins: string;
  icms?: number;
  pis?: number;
  cofins?: number;
  isentoipi: IsentoIPI;
  ipi?: number;
  naotemst?: string;
  prodepe?: string;
  hanan?: string;
  descontopiscofins?: string;
  ii?: number;
  cest: string;

  prfabr?: number;
  prcustoatual?: number;
  preconf?: number;
  precosnf?: number;
  prcompra: number;
  prcomprasemst?: number;
  pratualdesp?: number;
  txdolarcompra?: number;
  prvenda?: number;
  primp?: number;
  impfat?: number;
  impfab?: number;
  concor?: number;
  txdolarvenda?: number;

  codprod: string;
  qtdreservada: number;
  qtest_filial: number;
  cmercd: string;
  cmercf: string;
  margem: number;
  margempromo: number;
  cmerczf: string;
  excluido: number;
  qtestmax_sugerido: number;
  prmedio: number;
  qtest: number; // Quantidade em estoque
  consumo_interno: boolean;

  // Campos de Comissão Diferenciada
  comdifeext?: number;      // Comissão Diferenciada Externa
  comdifeext_int?: number;  // Comissão Diferenciada Externa Internacional
  comdifint?: number;       // Comissão Diferenciada Interna

  // Campos de Taxa de Câmbio
  txdolarfabrica?: number;     // Taxa Dólar Fábrica
  txdolarcompramedio?: number; // Taxa Dólar Compra Médio
}

/**
 * Define a estrutura da resposta paginada para uma lista de Produtos "Cru".
 */
export interface Produtos {
  data: Produto[];
  meta: Meta;
}

// =========================================================================
// NOVA INTERFACE PARA PRODUTO ENRIQUECIDO E SEU RETORNO
// =========================================================================
/**
 * Define a estrutura de um objeto Produto "Enriquecido".
 * Inclui dados adicionais de outras tabelas ou cálculos específicos.
 * Adapte este tipo para incluir as propriedades extras que você precisa.
 */
export interface ProdutoEnriquecido extends Produto {
  // --- NOVOS CAMPOS / RELAÇÕES ---
  precoFinalCalculado?: number; // Ex: preço com regras de cliente/promoção
  unidadeMedida?: string; // Já existe em Produto, mas pode ser mais específica aqui
  listaPrecoAplicada?: string;
  // ... outras propriedades resultantes de joins ou cálculos complexos
  // Ex: ultimaCompraInfo?: { data: string; preco: number };
  // Ex: infoFiscal?: { ncm: string; icms: number };
}

/**
 * Define a estrutura da resposta paginada para uma lista de Produtos "Enriquecidos".
 */
export interface ProdutosEnriquecidosResponse {
  data: ProdutoEnriquecido[];
  meta: Meta;
}

// --- Tipos para Filtro e Parâmetros de Busca de Produtos ---
/**
 * Define a estrutura de um filtro individual a ser aplicado na busca.
 */
export type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

/**
 * Define os parâmetros para a função de busca de produtos simples.
 */
export type GetParams = {
  page?: number;
  perPage?: number;
  search?: string;
  filtros?: Filtro[];
};

/**
 * Define os parâmetros para a função de busca de produtos.
 */
export type GetProdutosParams = {
  page?: number;
  perPage?: number;
  productSearch?: string; // Termo de busca geral
  tipoPreco?: string; // O tipo de preço fixo do cliente (balcão, ZFM, etc.)
  filtros?: Filtro[]; // Array de filtros dinâmicos
  // Você pode adicionar parâmetros específicos aqui se for uma busca "enriquecida"
  // Ex: clienteId?: string; // Se a precificação depender do cliente
};

// --- Tipos de enum para Produto ---
export type Curva = 'A' | 'B' | 'C' | 'D';
export type Informativo = '*' | 'A' | 'B' | 'C' | 'D';
export type UnidadeMedida =
  | 'PC'
  | 'UN'
  | 'KT'
  | 'CX'
  | 'CJ'
  | 'JG'
  | 'LT'
  | 'ML'
  | 'MT'
  | 'PT'
  | 'KG'
  | 'CT'
  | 'PR'
  | 'RL';
export type CompraDireta = 'SIM' | 'NAO';
export type Dolar = 'S' | 'N';
export type TipoProduto = 'ME' | 'MC';
export type IsentoIPI = 'S' | 'C' | 'P' | 'Z' | 'I' | 'T';

// --- Função: getProdutos (para busca simples, antiga getPromocoesByProduct) ---
/**
 * Busca produtos no backend com base em parâmetros de paginação e um termo de busca simples.
 * Retorna a estrutura `Produto` "cru".
 *
 * @param {Object} params - Parâmetros da busca.
 * @returns {Promise<Produtos>} Uma promessa que resolve para um objeto `Produtos`.
 */
export async function getProdutosSimples({
  page,
  perPage,
  productSearch,
  tipoPreco,
}: {
  page: number;
  perPage: number;
  productSearch?: string;
  tipoPreco?: string;
}): Promise<Produtos> {
  let produtosResult: Produtos = {
    data: [],
    meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 },
  };

  try {
    // Endpoint para busca de produtos "cru", geralmente via GET
    const response = await api.get(`/api/produtos/simples`, {
      // <-- NOVO ENDPOINT RECOMENDADO
      params: {
        page: page,
        perPage: perPage,
        search: productSearch,
        PRVENDA: tipoPreco,
      },
    });

    if (response.data && response.data.meta && response.data.data) {
      const apiMeta = response.data.meta;
      produtosResult = {
        data: response.data.data,
        meta: {
          total: apiMeta.total,
          lastPage: apiMeta.totalPages || apiMeta.lastPage,
          currentPage: apiMeta.currentPage,
          perPage: apiMeta.perPage,
        },
      };
    } else {
      console.warn(
        'Estrutura de resposta da API de busca de produtos simples inesperada:',
        response.data,
      );
    }
  } catch (error) {
    console.error('Erro ao buscar produtos simples:', error);
    throw error;
  }

  return produtosResult;
}

// --- Função: buscaProdutosComFiltro (Para DataTable com filtros, retorna Produto "Cru") ---
/**
 * Busca produtos no backend, suportando termos de busca gerais e filtros complexos por coluna.
 * Retorna a estrutura `Produto` "cru". Ideal para DataTables genéricos.
 *
 * @param {GetProdutosParams} params - Os parâmetros para a busca.
 * @returns {Promise<Produtos>} Uma promessa que resolve para um objeto `Produtos`.
 */
export async function buscaProdutosComFiltro({
  page = 1,
  perPage = 10,
  productSearch = '',
  tipoPreco = '',
  filtros = [],
}: GetProdutosParams): Promise<Produtos> {
  try {
    const filtrosCorrigidos = filtros.map((filtro) => ({
      ...filtro,
      valor: String(filtro.valor),
    }));

    // Endpoint para busca de produtos "cru" com filtros, geralmente via POST
    const response = await api.post('/api/produtos/buscaComFiltro', {
      // <-- NOVO ENDPOINT RECOMENDADO
      page,
      perPage,
      productSearch,
      tipoPreco,
      filtros: filtrosCorrigidos,
    });

    return response.data;
  } catch (error) {
    console.error('Erro em buscaProdutosComFiltro:', error);
    throw error;
  }
}

// =========================================================================
// NOVA FUNÇÃO: getProdutosEnriquecidos (Para dados específicos/relacionados)
// =========================================================================
/**
 * Busca um único produto no backend, trazendo dados "enriquecidos" que podem incluir
 * relações com outras tabelas ou cálculos complexos de preço.
 * Este endpoint deve ser mais robusto e pode aceitar parâmetros adicionais.
 *
 * @param {Object} params - Parâmetros da busca, pode incluir clienteId, data, etc.
 * @param {string} params.codprod - O código do produto a buscar.
 * @param {string} [params.clienteId] - O ID do cliente, se a precificação for específica.
 * @returns {Promise<ProdutoEnriquecido | null>} Uma promessa que resolve para um `ProdutoEnriquecido`
 * ou `null` se não encontrado.
 */
export async function getProdutoEnriquecidoByCod({
  codprod,
  clienteId,
}: {
  codprod: string;
  clienteId?: string;
}): Promise<ProdutoEnriquecido | null> {
  try {
    // Endpoint para buscar um único produto enriquecido por código
    const response = await api.get(`/api/produtos/detalhes/${codprod}`, {
      // <-- NOVO ENDPOINT RECOMENDADO
      params: {
        clienteId: clienteId, // Exemplo de parâmetro adicional
      },
    });

    // Assumindo que o backend retorna 200 OK e o produto, ou 404 se não encontrado
    if (response.data) {
      return response.data; // Assumimos que response.data já é um ProdutoEnriquecido
    }
    return null;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.warn(`Produto enriquecido com código ${codprod} não encontrado.`);
      return null;
    }
    console.error('Erro ao buscar produto enriquecido:', error);
    throw error;
  }
}

/**
 * Busca uma lista paginada de produtos "enriquecidos" para cenários onde
 * a lista completa com dados relacionados é necessária (ex: tela de vendas).
 *
 * @param {GetProdutosParams} params - Parâmetros da busca, incluindo paginação, termo de busca e filtros.
 * Pode incluir parâmetros específicos como `clienteId`.
 * @returns {Promise<ProdutosEnriquecidosResponse>} Promessa de um objeto `ProdutosEnriquecidosResponse`.
 */
export async function getListaProdutosEnriquecidos({
  page = 1,
  perPage = 10,
  productSearch = '',
  tipoPreco = '', // ou um parâmetro mais específico como 'tabelaPrecoId'
  filtros = [],
  clienteId, // Exemplo de parâmetro adicional que afeta o enriquecimento
}: GetProdutosParams & {
  clienteId?: string;
}): Promise<ProdutosEnriquecidosResponse> {
  try {
    const filtrosCorrigidos = filtros.map((filtro) => ({
      ...filtro,
      valor: String(filtro.valor),
    }));

    // Endpoint para buscar uma lista de produtos enriquecidos com paginação e filtros
    const response = await api.post('/api/produtos/listaEnriquecida', {
      // <-- NOVO ENDPOINT RECOMENDADO
      page,
      perPage,
      productSearch,
      tipoPreco,
      filtros: filtrosCorrigidos,
      clienteId, // Passa o ID do cliente se necessário
    });

    return response.data; // Assumimos que response.data já é um ProdutosEnriquecidosResponse
  } catch (error) {
    console.error('Erro ao buscar lista de produtos enriquecidos:', error);
    throw error;
  }
}

// --- Funções do segundo arquivo, mantidas e integradas ---

/**
 * Busca produtos no backend com base em parâmetros de paginação e um termo de busca.
 * @param {GetParams} params - Parâmetros da busca.
 * @returns {Promise<Produtos>} Uma promessa que resolve para um objeto `Produtos`.
 */
export async function getProdutos({
  page,
  perPage,
  search,
}: GetParams): Promise<Produtos> {
  let produtos: Produtos = {} as Produtos;

  await api
    .get(`/api/produtos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      produtos = response.data;
    });

  return produtos;
}

/**
 * Insere um novo produto no backend.
 * @param {Produto} produto - O objeto Produto a ser inserido.
 * @returns {Promise<void>} Uma promessa que resolve quando a operação é concluída.
 */
export async function insertProduto(produto: Produto): Promise<void> {
  await api.post('/api/produtos/add', produto);
}

/**
 * Busca um único produto pelo seu código.
 * @param {string} codprod - O código do produto a ser buscado.
 * @returns {Promise<Produto>} Uma promessa que resolve para o objeto `Produto`.
 */
export async function getProduto(
  codprod: string,
  signal?: AbortSignal,
): Promise<Produto> {
  let produto: Produto = {} as Produto;

  await api.get(`/api/produtos/get/${codprod}`, { signal }).then((response) => {
    produto = response.data;
  });

  return produto;
}

/**
 * Atualiza um produto existente no backend.
 * @param {Produto} produto - O objeto Produto com os dados atualizados.
 * @returns {Promise<void>} Uma promessa que resolve quando a operação é concluída.
 */
export async function updateProduto(produto: Produto): Promise<void> {
  await api.put(`/api/produtos/update`, produto);
}

/**
 * Busca um produto pelo seu código de barras.
 * @param {string} codbar - O código de barras do produto a ser buscado.
 * @returns {Promise<Produto>} Uma promessa que resolve para o objeto `Produto`.
 */
export async function getProdutoByCodBar(codbar: string): Promise<Produto> {
  let produto: Produto = {} as Produto;

  await api
    .get(`/api/produtos/get/by-codbar?codbar=${codbar}`)
    .then((response) => {
      produto = response.data;
    });

  return produto;
}

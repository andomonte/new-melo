// src/data/promocoes/promocoes.ts

import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

//itens retornados do banco
export interface ItemPromocao {
  id_promocao_item: number;
  id_promocao: number;
  codprod: string | null;
  codgpp: string | null;
  descricao: string | null;

  marca?: string | null; // ✅ NOVO
  qtddisponivel?: number | null; // ✅ NOVO
  preco?: number | null;
  qtde_maxima_item: number | null;
  qtde_minima_item: number | null;
  tipo_desconto_item: 'PERC' | 'VALO' | 'PREF' | null;
  valor_desconto_item: number | null;
  qtdVendido: number | null;
  qtdFaturado: number | null;
  qtd_total_item?: number | null;
  origem: string | null;
}

// --- INTERFACE Promocao ---
export interface Promocao {
  id_promocao: number;
  nome_promocao: string;
  descricao_promocao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo_promocao: 'PROD' | 'GRUPO';
  valor_desconto: number;
  tipo_desconto: 'PERC' | 'VALO' | 'PREF';
  qtde_minima_ativacao: number;
  qtde_maxima_total: number | null;
  qtde_maxima_por_cliente: number | null;
  ativa: boolean;
  criado_em?: string;
  criado_por: string;
  observacoes: string | null;

  // ✅ CORRIGIR AQUI:
  itens_promocao?: ItemPromocao[]; // em vez de ProdutoCarrinhoTemp[]
}

// --- INTERFACE Promocao ---
export interface PromocaoParaVer {
  id_promocao: number;
  nome_promocao: string;
  descricao_promocao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo_promocao: 'PROD' | 'GRUPO';
  valor_desconto: number;
  tipo_desconto: 'PERC' | 'VALO' | 'PREF';
  qtde_minima_ativacao: number;
  qtde_maxima_total: number | null;
  qtde_maxima_por_cliente: number | null;
  ativa: boolean;
  criado_em?: string;
  criado_por: string;
  observacoes: string | null;
  // Adicione esta propriedade para os itens associados à promoção
  itens_promocao?: (ProdutoCarrinhoTemp | ItemPromocao)[]; // Utiliza ProdutoCarrinhoTemp
}

// --- INTERFACE Promocoes ---
export interface Promocoes {
  data: Promocao[];
  meta: Meta;
}

// --- INTERFACE ProdutoCarrinhoTemp (Permanece aqui por ser específica da lógica de promoção/carrinho) ---
/**
 * Interface para representar um produto no contexto de um "carrinho temporário" de promoção.
 * Contém detalhes específicos necessários para a manipulação dentro do modal de adição de produtos.
 */
export interface ProdutoCarrinhoTemp {
  codigo: string;
  descrição: string;
  marca: string;
  estoque: string; // Quantidade em estoque do produto
  preço: string; // Preço de venda do produto
  ref: string;
  quantidade: string; // Quantidade que o usuário deseja adicionar
  descriçãoEditada: string; // Descrição que pode ser editada (se o modal permitir)
  totalItem: string; // Valor total do item (preço * quantidade)
  precoItemEditado: string; // Preço final do item (após possível desconto)
  tipoPreço: string; // Tipo de preço (balcão, ZFM, etc.)
  desconto: number; // Desconto aplicado ao item
  origem: string; // Ex: 'DOLAR' se vier de `val.DOLAR` ou similar
  qtdVendido: number | null;
  qtdFaturado: number | null;
  qtd_total_item?: number | null;
  tipoDescontoItem: 'PERC' | 'VALO' | 'PREF';
  qtdMinima?: number; // <<<<< ADICIONE ESTA LINHA
  qtdMaxima?: number;
  codgpp?: string;
}
export interface PromocaoComItensFixos {
  nome_promocao: string;
  itens_promocao?: ItemPromocao[];
}
// ✨ NOVA INTERFACE: Payload para a função de salvar/atualizar promoções com itens
export interface SalvarPromocaoPayload {
  promocao: Promocao;
  itens: ItemPromocao[];
}

// --- FUNÇÕES DE PROMOÇÃO (As que você confirmou que estão funcionando - SEM ALTERAÇÕES) ---

/**
 * Busca uma lista paginada e filtrada de promoções ativas.
 * @param page Número da página.
 * @param perPage Quantidade de itens por página.
 * @param search Termo de busca (ex: nome_promocao).
 * @returns Promessa de um objeto Promocoes contendo os dados e metadados.
 */
export async function getPromocoes({
  page,
  perPage,
  search,
}: GetParams): Promise<Promocoes> {
  let promocoes: Promocoes = {
    data: [],
    meta: {
      total: 0,
      lastPage: 1,
      currentPage: 1,
      perPage: 10,
    },
  };

  try {
    const response = await api.get(
      `/api/promocoes/get?page=${page}&perPage=${perPage}&search=${search}`,
    );

    if (response.data && response.data.meta && response.data.data) {
      const apiMeta = response.data.meta;
      promocoes = {
        data: response.data.data,
        meta: {
          total: apiMeta.total,
          lastPage: apiMeta.totalPages,
          currentPage: apiMeta.currentPage,
          perPage: apiMeta.perPage,
        },
      };
    } else {
      console.warn(
        'Estrutura de resposta da API de promoções inesperada:',
        response.data,
      );
    }
  } catch (error) {
    console.error('Erro ao buscar promoções na camada de dados:', error);
    throw error;
  }

  return promocoes;
}

// REMOVIDO: A antiga função insertPromocao será substituída pela nova unificada
// export async function insertPromocao(promocao: Promocao): Promise<void> {
//   await api.post('/api/promocoes/add', promocao);
// }

/**
 * Busca uma única promoção pelo seu ID.
 * @param id O ID da promoção.
 * @returns Promessa de um objeto Promocao.
 */
export async function getPromocao(id: number): Promise<Promocao> {
  let promocao: Promocao = {} as Promocao;
  try {
    const response = await api.get(`/api/promocoes/get/${id}`);
    promocao = response.data;
  } catch (error) {
    console.error('Erro ao buscar promoção por ID na camada de dados:', error);
    throw error;
  }
  return promocao;
}

// REMOVIDO: A antiga função updatePromocao será substituída pela nova unificada
// export async function updatePromocao(promocao: Promocao): Promise<void> {
//   await api.put(`/api/promocoes/update`, promocao);
// }

/**
 * Deleta uma promoção pelo seu ID.
 * @param id O ID da promoção a ser deletada.
 * @returns Promessa vazia (void) se a operação for bem-sucedida.
 */
export async function deletarPromocao(id: number): Promise<void> {
  try {
    await api.delete(`/api/promocoes/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar promoção na camada de dados:', error);
    throw error;
  }
}

/**
 * Busca uma lista de todas as promoções (sem paginação ou filtros complexos).
 * Útil para listagens simples onde todos os dados são necessários de uma vez.
 * @returns Promessa de um objeto TodasPromocoesResponse contendo um array de Promocao.
 */
export interface TodasPromocoesResponse {
  data: Promocao[];
}

export async function getTodasPromocoes(): Promise<TodasPromocoesResponse> {
  let todasPromocoes: TodasPromocoesResponse = { data: [] };
  try {
    await api.get(`/api/promocoes/get/todasPromocoes`).then((response) => {
      todasPromocoes = response.data;
    });
  } catch (error) {
    console.error(
      'Erro ao buscar todas as promoções na camada de dados:',
      error,
    );
    throw error;
  }
  return todasPromocoes;
}

// ✨ NOVA FUNÇÃO UNIFICADA: insertPromocao (agora lida com criação e atualização, incluindo itens)
/**
 * Salva (cria ou atualiza) uma promoção e seus itens associados no backend.
 * Esta função unifica a lógica de 'inserir' e 'atualizar' promoções.
 * @param payload Contém os dados da promoção e a lista de itens.
 * @returns A promoção salva com quaisquer IDs gerados pelo backend.
 */

export async function insertPromocao(
  payload: SalvarPromocaoPayload,
): Promise<Promocao> {
  try {
    // Determina o método (POST para nova, PUT para atualização)
    // Se id_promocao existir e for diferente de 0, considera uma atualização.
    // Caso contrário, considera uma nova criação.
    const method =
      payload.promocao.id_promocao && payload.promocao.id_promocao !== 0
        ? 'PUT'
        : 'POST';

    // O endpoint unificado para salvar/atualizar promoções com itens.
    // É crucial que seu backend suporte esta lógica no endpoint '/api/promocoes/save'.
    const url = `/api/promocoes/add`; // Adapte este URL conforme sua API real, se necessário

    const response = await api({
      method: method,
      url: url,
      data: payload, // Envia o payload completo (promocao e itens)
    });

    if (response.data) {
      return response.data as Promocao; // O backend deve retornar a promoção salva/atualizada (com o ID gerado para novas)
    } else {
      throw new Error('Resposta inesperada da API ao salvar promoção.');
    }
  } catch (error) {
    console.error(
      'Erro ao salvar promoção com itens na camada de dados:',
      error,
    );
    throw new Error(
      `Falha ao salvar a promoção: ${
        (error as Error).message || 'Erro desconhecido'
      }`,
    );
  }
}

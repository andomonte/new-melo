// data/vendas/bloqueadas.ts

// Importa a instância configurada do Axios para as chamadas à API.
import api from '@/components/services/api';

/**
 * Define um tipo para um item de uma venda bloqueada.
 */
export interface ItemVendaBloqueada {
  codvenda: string;
  codprod: string;
  quantidade: number;
  preco: number;
  // adicione outros campos conforme necessário
}

/**
 * Define um tipo para dados básicos do cliente.
 */
export interface ClienteBasico {
  codcli: string;
  nome: string | null;
  nomefant: string | null;
}

/**
 * Define um tipo para uma venda bloqueada.
 */
export interface VendaBloqueada {
  codvenda: string;
  codcli: string | null;
  data: Date;
  status: string;
  total: number | null; // Campo total da venda
  // outros campos da dbvenda que você precisar

  /**
   * Array contendo os itens da venda. A API anexa esta propriedade.
   */
  dbitvenda: ItemVendaBloqueada[];

  /**
   * Objeto com os dados do cliente relacionado, preenchido pela API.
   * Pode ser nulo se não houver cliente associado.
   */
  dbclien: ClienteBasico | null;
}

/**
 * Define a estrutura do objeto de resposta completo da API de vendas bloqueadas.
 */
export interface VendasBloqueadasResponse {
  /**
   * Um array de objetos `VendaBloqueada`, contendo os dados da página atual.
   */
  data: VendaBloqueada[];
  /**
   * Objeto com os metadados necessários para a paginação.
   */
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
  };
}

/**
 * Define a estrutura dos parâmetros para a função `getVendasBloqueadas`.
 */
interface GetVendasBloqueadasParams {
  page: number;
  perPage: number;
  codvenda?: string; // Filtro opcional por código da venda, para futuras implementações.
}

/**
 * Busca uma lista paginada de vendas bloqueadas no backend.
 * Esta função encapsula a lógica de chamada da API, servindo como uma camada de dados
 * para os componentes da interface.
 *
 * @param params - Objeto contendo os parâmetros de paginação e filtros.
 * @returns Uma promessa que resolve para um objeto `VendasBloqueadasResponse`.
 */
export async function getVendasBloqueadas({
  page,
  perPage,
  codvenda,
}: GetVendasBloqueadasParams): Promise<VendasBloqueadasResponse> {
  // Inicializa um objeto de retorno padrão para garantir consistência.
  let responseData: VendasBloqueadasResponse = {
    data: [],
    meta: {
      total: 0,
      lastPage: 1,
      currentPage: 1,
      perPage: perPage,
    },
  };

  try {
    // Constrói os parâmetros da URL de forma segura.
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });

    // Adiciona o filtro à URL apenas se ele for fornecido.
    if (codvenda) {
      params.append('codvenda', codvenda);
    }

    // Executa a chamada GET para o nosso novo endpoint.
    const response = await api.get(
      `/api/vendas/bloqueadas?${params.toString()}`,
    );

    // Valida e mapeia a resposta da API.
    if (response.data && response.data.meta && response.data.data) {
      const apiMeta = response.data.meta;
      responseData = {
        data: response.data.data,
        meta: {
          total: apiMeta.total,
          lastPage: apiMeta.totalPages, // Mapeia `totalPages` do backend para `lastPage` no frontend.
          currentPage: apiMeta.currentPage,
          perPage: apiMeta.perPage,
        },
      };
    } else {
      console.warn(
        'Estrutura de resposta da API de vendas bloqueadas inesperada:',
        response.data,
      );
    }
  } catch (error) {
    console.error(
      'Erro ao buscar vendas bloqueadas na camada de dados:',
      error,
    );
    // Relança o erro para que a camada de UI (o componente React) possa tratá-lo.
    throw error;
  }

  return responseData;
}

/**
 * Define os parâmetros para a função de desbloqueio.
 */
interface UnblockVendaParams {
  codvenda: string;
  newStatus: string; // Ex: 'L' para Liberada, 'N' para Normal
}

/**
 * Envia uma requisição para o backend para desbloquear uma venda específica.
 * @param params - Objeto contendo o código da venda e o novo status.
 * @returns Uma promessa que resolve para os dados da venda atualizada.
 */
export async function unblockVenda({
  codvenda,
  newStatus,
}: UnblockVendaParams): Promise<VendaBloqueada> {
  try {
    // Executa a chamada PATCH para o endpoint dinâmico /api/vendas/[codvenda].
    // O corpo da requisição (segundo argumento) leva o novo status.
    const response = await api.patch(`/api/vendas/${codvenda}`, {
      status: newStatus,
    });

    // Retorna os dados da venda atualizada como confirmação.
    return response.data;
  } catch (error) {
    console.error(`Erro ao desbloquear a venda ${codvenda}:`, error);
    // Relança o erro para que o componente da UI possa tratá-lo (ex: exibir um toast).
    throw error;
  }
}

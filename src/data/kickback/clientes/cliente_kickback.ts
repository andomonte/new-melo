// Importa a instância configurada do Axios.
import api from '@/components/services/api';

/**
 * Define o tipo para um registro de kickback de cliente.
 */
export interface ClienteKickback {
  id: number;
  codcli: string;
  class: string | null;
  status: string;
  g: string;
}

/**
 * Define a estrutura da resposta da API para a listagem paginada.
 */
export interface ClientesKickbackResponse {
  data: ClienteKickback[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
  };
}

/**
 * Define a estrutura dos parâmetros para a busca.
 */
interface GetClientesKickbackParams {
  page: number;
  perPage: number;
  search?: string;
}

export async function importClientesKickback(
  data: Partial<ClienteKickback>[],
): Promise<any> {
  try {
    console.log(data);
    // // Esta função fará um POST para uma nova rota de API que vamos criar.
    // const response = await api.post('/api/kickback/clientes/import', data);
    // console.info(response.data);
    // return response.data;
  } catch (error) {
    console.error('Erro ao importar planilha de clientes kickback:', error);
    throw error;
  }
}

/**
 * Busca uma lista paginada de kickbacks de clientes.
 */
export async function getClientesKickback({
  page,
  perPage,
  search,
}: GetClientesKickbackParams): Promise<ClientesKickbackResponse> {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });
  if (search) params.append('search', search);

  try {
    const response = await api.get(
      `/api/kickback/clientes?${params.toString()}`, // <-- A URL é esta
    );
    return {
      data: response.data.data,
      meta: {
        total: response.data.meta.total,
        lastPage: response.data.meta.lastPage,
        currentPage: response.data.meta.currentPage,
        perPage: response.data.meta.perPage,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar kickback de clientes:', error);
    throw error;
  }
}

/**
 * Cria um novo registro de kickback de cliente.
 */
export async function createClienteKickback(
  data: Omit<ClienteKickback, 'codcli'> & { codcli: string },
): Promise<ClienteKickback> {
  try {
    const response = await api.post('/api/kickback/clientes', data);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar kickback de cliente:', error);
    throw error;
  }
}

/**
 * Atualiza um registro de kickback de cliente.
 */
export async function updateClienteKickback(
  id: number, // <-- MUDANÇA: Recebe 'id' como número
  data: Partial<ClienteKickback>,
): Promise<ClienteKickback> {
  try {
    // MUDANÇA: Usa o 'id' na URL
    const response = await api.put(`/api/kickback/clientes/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`Erro ao atualizar kickback do cliente ID ${id}:`, error);
    throw error;
  }
}

/**
 * Deleta um registro de kickback de cliente.
 */
export async function deleteClienteKickback(id: number): Promise<void> {
  // <-- MUDANÇA: Recebe 'id' como número
  try {
    // MUDANÇA: Usa o 'id' na URL
    await api.delete(`/api/kickback/clientes/${id}`);
  } catch (error) {
    console.error(`Erro ao deletar kickback do cliente ID ${id}:`, error);
    throw error;
  }
}

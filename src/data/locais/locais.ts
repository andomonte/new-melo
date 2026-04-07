import api from '@/components/services/api';
import { GetParams } from '../common/getParams';
import { PaginationMeta, Filtro } from '@/components/common/genericCrudPage';

// --- INTERFACES ---

/**
 * Define a estrutura de um objeto de Local.
 * Baseado no modelo da tabela "dblocal".
 * Campos opcionais são marcados com "?".
 */
export interface Local {
  id_local: string; // Chave primária, é uma string
  id_armazem: number;
  descricao?: string;
  tipo_local?: string;
  capacidade?: string; // Mantido como string para consistência com valores decimais da API
  unidade?: string;
}

/**
 * Define a estrutura da resposta da API para uma lista de locais.
 */
export interface Locais {
  data: Local[];
  meta: PaginationMeta;
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de locais.
 * A busca pode ser feita pela descrição do local ou pelo ID.
 * Suporta filtros avançados por coluna.
 */
export async function getLocais({
  page,
  perPage,
  search,
  filtros = [],
}: GetParams & { filtros?: Filtro[] }): Promise<Locais> {
  const response = await api.get<Locais>('/api/locais', {
    params: { page, perPage, search, filtros: JSON.stringify(filtros) },
  });
  return response.data;
}

/**
 * Busca um único local pelo seu ID.
 * O ID aqui é uma string, conforme a chave primária "id_local".
 */
export async function getLocal(id: string | number): Promise<Local> {
  const response = await api.get<Local>(`/api/locais/${id}`);
  return response.data;
}

/**
 * Cria um novo local.
 * O objeto enviado deve corresponder à interface Local.
 */
export async function createLocal(data: Local): Promise<Local> {
  const response = await api.post<Local>('/api/locais', data);
  return response.data;
}

/**
 * Atualiza um local existente.
 * O 'data' pode ser um objeto parcial com os campos a serem atualizados.
 * Não é permitido atualizar a chave primária "id_local".
 */
export async function updateLocal(
  id: string | number,
  data: Partial<Local>,
): Promise<Local> {
  const response = await api.put<Local>(`/api/locais/${id}`, data);
  return response.data;
}

/**
 * Deleta um local pelo seu ID.
 */
export async function deleteLocal(id: string | number): Promise<void> {
  await api.delete(`/api/locais/${id}`);
}

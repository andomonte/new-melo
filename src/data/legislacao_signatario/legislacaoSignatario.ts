import api from '@/components/services/api';
import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage';

// --- INTERFACES ---

/**
 * Define a estrutura de um objeto de Signatário da Legislação.
 */
export interface LegislacaoSignatario {
  LES_ID?: number; // Opcional para permitir auto-increment
  LES_LEI_ID: number;
  LES_UF: string;
  LES_MVA_ST_ORIGINAL: string | number; // Pode ser string ou number
}

/**
 * Define a estrutura da resposta da API para uma lista de signatários.
 */
export interface LegislacoesSignatario {
  data: LegislacaoSignatario[];
  meta: PaginationMeta;
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de signatários da legislação.
 */
export async function getLegislacoesSignatario({
  page,
  perPage,
  search,
  filtros, // Adicionado suporte para filtros
}: GetParams): Promise<LegislacoesSignatario> {
  // Se tem filtros, usar POST; senão usar GET com search
  if (filtros && filtros.length > 0) {
    const response = await api.post<LegislacoesSignatario>(
      '/api/legislacao_signatario',
      {
        page,
        perPage,
        filtros,
      },
    );
    return response.data;
  } else {
    const response = await api.get<LegislacoesSignatario>(
      '/api/legislacao_signatario',
      {
        params: { page, perPage, search },
      },
    );
    return response.data;
  }
}

/**
 * Busca um único signatário pelo seu ID.
 */
export async function getLegislacaoSignatario(
  id: string | number,
): Promise<LegislacaoSignatario> {
  const response = await api.get<LegislacaoSignatario>(
    `/api/legislacao_signatario/${id}`,
  );
  return response.data;
}

/**
 * Cria um novo signatário para uma legislação.
 */
export async function createLegislacaoSignatario(
  data: Omit<LegislacaoSignatario, 'LES_ID'>, // Omitimos LES_ID
): Promise<LegislacaoSignatario> {
  const response = await api.post<LegislacaoSignatario>(
    '/api/legislacao_signatario',
    data,
  );
  return response.data;
}

/**
 * Atualiza um signatário existente.
 * O 'data' pode ser um objeto parcial com os campos a serem atualizados.
 */
export async function updateLegislacaoSignatario(
  id: string | number,
  data: Partial<LegislacaoSignatario>,
): Promise<LegislacaoSignatario> {
  const response = await api.put<LegislacaoSignatario>(
    `/api/legislacao_signatario/${id}`,
    data,
  );
  return response.data;
}

/**
 * Deleta um signatário pelo seu ID.
 */
export async function deleteLegislacaoSignatario(
  id: string | number,
): Promise<void> {
  await api.delete(`/api/legislacao_signatario/${id}`);
}

import api from '@/components/services/api';
import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage';

// --- INTERFACES ---

/**
 * Define a estrutura de um objeto de NCM da Legislação de ICMS ST.
 */
export interface LegislacaoNcm {
  LIN_ID?: number; // Opcional para permitir auto-increment
  LIN_LEI_ID: number;
  LIN_NCM: string;
  LIN_STATUS: string;
  LIN_MVA_ST_ORIGINAL: string | number; // Pode ser string ou number
  LIN_CEST?: string; // Opcional
}

/**
 * Define a estrutura da resposta da API para uma lista de NCMs da legislação.
 */
export interface LegislacoesNcm {
  data: LegislacaoNcm[];
  meta: PaginationMeta;
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de NCMs da legislação.
 */
export async function getLegislacoesNcm({
  page,
  perPage,
  search,
  filtros, // Adicionado suporte para filtros
}: GetParams): Promise<LegislacoesNcm> {
  // Se tem filtros, usar POST; senão usar GET com search
  if (filtros && filtros.length > 0) {
    const response = await api.post<LegislacoesNcm>(
      '/api/legislacao_icmsst_ncm',
      {
        page,
        perPage,
        filtros,
      },
    );
    return response.data;
  } else {
    const response = await api.get<LegislacoesNcm>(
      '/api/legislacao_icmsst_ncm',
      {
        params: { page, perPage, search },
      },
    );
    return response.data;
  }
}

/**
 * Busca um único NCM da legislação pelo seu ID.
 */
export async function getLegislacaoNcm(
  id: string | number,
): Promise<LegislacaoNcm> {
  const response = await api.get<LegislacaoNcm>(
    `/api/legislacao_icmsst_ncm/${id}`,
  );
  return response.data;
}

/**
 * Cria um novo NCM para uma legislação.
 */
export async function createLegislacaoNcm(
  data: Omit<LegislacaoNcm, 'LIN_ID'>, // Omitimos LIN_ID
): Promise<LegislacaoNcm> {
  const response = await api.post<LegislacaoNcm>(
    '/api/legislacao_icmsst_ncm',
    data,
  );
  return response.data;
}

/**
 * Atualiza um NCM de uma legislação existente.
 * O 'data' pode ser um objeto parcial com os campos a serem atualizados.
 */
export async function updateLegislacaoNcm(
  id: string | number,
  data: Partial<LegislacaoNcm>,
): Promise<LegislacaoNcm> {
  const response = await api.put<LegislacaoNcm>(
    `/api/legislacao_icmsst_ncm/${id}`,
    data,
  );
  return response.data;
}

/**
 * Deleta um NCM de uma legislação pelo seu ID.
 */
export async function deleteLegislacaoNcm(id: string | number): Promise<void> {
  await api.delete(`/api/legislacao_icmsst_ncm/${id}`);
}

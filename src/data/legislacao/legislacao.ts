// Local sugerido: src/data/legislacao/legislacao.ts

import api from '@/components/services/api';
import { GetParams } from '../common/getParams'; // Supondo que você tenha este tipo comum
import { PaginationMeta } from '@/components/common/genericCrudPage';

// --- INTERFACES ---

/**
 * Define a estrutura de um objeto de Legislação de ICMS ST.
 * As datas virão como string no formato ISO 8601 da API.
 */
export interface LegislacaoIcmsst {
  LEI_ID: number;
  LEI_PROTOCOLO: number;
  LEI_DATA_CADASTRO: string;
  LEI_STATUS: string;
  LEI_DATA_VIGENCIA: string;
  LEI_DATA_PUBLICACAO: string;
  LEI_MVA_AJUSTADA: string;
  LEI_TIPO?: string | null;
}

/**
 * Define a estrutura da resposta da API para uma lista de legislações.
 */
export interface LegislacoesIcmsst {
  data: LegislacaoIcmsst[];
  meta: PaginationMeta; // <-- Usando o tipo importado e correto
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de legislações.
 */
export async function getLegislacoesIcmsst({
  page,
  perPage,
  search,
  filtros, // Adicionado suporte para filtros
}: GetParams): Promise<LegislacoesIcmsst> {
  // Se tem filtros, usar POST; senão usar GET com search
  if (filtros && filtros.length > 0) {
    const response = await api.post<LegislacoesIcmsst>(
      '/api/legislacao-icmsst',
      {
        page,
        perPage,
        filtros,
      },
    );
    return response.data;
  } else {
    const response = await api.get<LegislacoesIcmsst>(
      '/api/legislacao-icmsst',
      {
        params: { page, perPage, search },
      },
    );
    return response.data;
  }
}

/**
 * Busca uma única legislação pelo seu ID.
 */
export async function getLegislacaoIcmsst(
  id: string | number,
): Promise<LegislacaoIcmsst> {
  const response = await api.get<LegislacaoIcmsst>(
    `/api/legislacao-icmsst/${id}`,
  );
  return response.data;
}

/**
 * Cria uma nova legislação.
 */
export async function createLegislacaoIcmsst(
  data: Omit<LegislacaoIcmsst, 'LEI_DATA_CADASTRO'>, // Omitimos o campo que o backend preenche
): Promise<LegislacaoIcmsst> {
  const response = await api.post<LegislacaoIcmsst>(
    '/api/legislacao-icmsst',
    data,
  );
  return response.data;
}

/**
 * Atualiza uma legislação existente.
 * O 'data' pode ser um objeto parcial com os campos a serem atualizados.
 */
export async function updateLegislacaoIcmsst(
  id: string | number,
  data: Partial<LegislacaoIcmsst>,
): Promise<LegislacaoIcmsst> {
  const response = await api.put<LegislacaoIcmsst>(
    `/api/legislacao-icmsst/${id}`,
    data,
  );
  return response.data;
}

/**
 * Deleta uma legislação pelo seu ID.
 */
export async function deleteLegislacaoIcmsst(
  id: string | number,
): Promise<void> {
  await api.delete(`/api/legislacao-icmsst/${id}`);
}

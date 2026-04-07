// Local: src/services/cfopService.ts (ou similar)

import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage'; // ✅ Importando o tipo correto
import api from '@/components/services/api';

// --- INTERFACES ---

export interface Cfop {
  cfop: string;
  descr: string;
  cfopinverso?: string | null;
  excecao?: string;
}

// ✅ Garante que a interface Meta local seja compatível com a do componente genérico
export type Meta = PaginationMeta;

export interface Cfops {
  data: Cfop[];
  meta: Meta;
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de CFOPs.
 * Agora suporta filtros avançados via POST.
 */
export async function getCfops({
  page,
  perPage,
  search,
  filtros,
}: GetParams): Promise<Cfops> {
  // Se há filtros avançados, usar POST
  if (filtros && filtros.length > 0) {
    console.log('🔍 Enviando filtros via POST:', filtros);
    const response = await api.post('/api/cfop', {
      page,
      perPage,
      filtros,
    });
    return response.data;
  }

  // Se há busca global sem filtros, usar POST também para consistência
  if (search) {
    console.log('🔍 Enviando busca via POST:', search);
    const response = await api.post('/api/cfop', {
      page,
      perPage,
      search,
      filtros: [],
    });
    return response.data;
  }

  // Sem filtros nem busca, usar GET tradicional
  const response = await api.post('/api/cfop', {
    page,
    perPage,
    search: '',
    filtros: [],
  });
  return response.data;
}

/**
 * Cria um novo registro de CFOP.
 */
export async function createCfop(cfopData: Cfop): Promise<Cfop> {
  const response = await api.post('/api/cfop', cfopData);
  return response.data;
}

/**
 * Atualiza um registro de CFOP existente.
 */
export async function updateCfop(cfopData: Cfop): Promise<Cfop> {
  const response = await api.put(`/api/cfop/${cfopData.cfop}`, cfopData);
  return response.data;
}

/**
 * Busca um único CFOP pelo seu código.
 */
// ✅ Tipo do ID corrigido para 'string | number'
export async function getCfop(id: string | number): Promise<Cfop> {
  const response = await api.get(`/api/cfop/${id}`);
  return response.data;
}

/**
 * Deleta um registro de CFOP.
 */
// ✅ Tipo do ID corrigido para 'string | number'
export async function deleteCfop(id: string | number): Promise<void> {
  await api.delete(`/api/cfop/${id}`);
}

/**
 * Verifica se um CFOP já existe.
 */
export async function checkCfopExists(cfop: string): Promise<boolean> {
  try {
    const response = await api.get(`/api/cfop/check/${cfop}`);
    return response.data.exists;
  } catch (error) {
    console.error('Erro ao verificar CFOP:', error);
    return false;
  }
}

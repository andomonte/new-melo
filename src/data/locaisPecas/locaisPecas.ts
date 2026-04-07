// src/data/locaisPecas/locaisPecas.ts

import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

// Interface para Local das Peças
export interface LocalPeca {
  id_local: string;
  id_armazem: number;
  descricao: string | null;
  tipo_local: string | null;
  capacidade: number | null;
  unidade: string | null;
  // Dados do armazém para exibição
  armazem?: {
    id_armazem: number;
    nome: string | null;
    filial: string | null;
    ativo: boolean | null;
  };
}

// Interface para o retorno paginado
export interface LocaisPecas {
  data: LocalPeca[];
  meta: Meta;
}

// Interface para criação de local (sem id_local que é string gerada)
export interface NovoLocalPeca {
  id_local: string;
  id_armazem: number;
  descricao?: string | null;
  tipo_local?: string | null;
  capacidade?: number | null;
  unidade?: string | null;
}

// Interface para atualização de local
export interface AtualizarLocalPeca {
  id_local: string;
  id_armazem?: number;
  descricao?: string | null;
  tipo_local?: string | null;
  capacidade?: number | null;
  unidade?: string | null;
}

// Função para buscar locais com paginação
export async function getLocaisPecas({
  page,
  perPage,
  search,
}: GetParams): Promise<LocaisPecas> {
  try {
    const response = await api.get('/api/locaisPecas', {
      params: { page, perPage, search },
    });
    return response.data;
  } catch (error) {
    console.error('🚨 Erro ao buscar locais de peças:', error);
    throw error;
  }
}

// Função para buscar um local específico
export async function getLocalPeca(id: string): Promise<LocalPeca> {
  try {
    const response = await api.get(`/api/locaisPecas/${id}`);
    return response.data.data;
  } catch (error) {
    console.error(`🚨 Erro ao buscar local ${id}:`, error);
    throw error;
  }
}

// Função para inserir novo local
export async function insertLocalPeca(local: NovoLocalPeca): Promise<void> {
  try {
    await api.post('/api/locaisPecas', { ...local, action: 'create' });
  } catch (error) {
    console.error('🚨 Erro ao inserir local de peça:', error);
    throw error;
  }
}

// Função para atualizar local
export async function updateLocalPeca(
  local: AtualizarLocalPeca,
): Promise<void> {
  try {
    await api.put(`/api/locaisPecas/${local.id_local}`, local);
  } catch (error) {
    console.error('🚨 Erro ao atualizar local de peça:', error);
    throw error;
  }
}

// Função para deletar local
export async function deletarLocalPeca(id: string): Promise<void> {
  try {
    await api.delete(`/api/locaisPecas/${id}`);
  } catch (error) {
    console.error('🚨 Erro ao deletar local da peça:', error);
    throw error;
  }
}

// Interface para lista simples de armazéns (para select)
export interface ArmazemOption {
  id_armazem: number;
  nome: string;
  filial: string | null;
  ativo: boolean;
}

// Função para buscar todos os armazéns ativos (para select)
export async function getTodosArmazensAtivos(): Promise<ArmazemOption[]> {
  try {
    const response = await api.get('/api/locaisPecas/armazens');
    return response.data.data || [];
  } catch (error) {
    console.error('🚨 Erro ao buscar armazéns:', error);
    throw error;
  }
}

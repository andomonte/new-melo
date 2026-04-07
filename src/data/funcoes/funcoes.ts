import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface Funcao {
  id_functions: number;
  descricao: string;
  codigo_filial?: number;
  usadoEm?: string | null;
  sigla?: string | null;
}

export interface Funcoes {
  data: Funcao[];
  meta: Meta;
}

/**
 * Busca Funções com Paginação
 */
export async function getFuncoes({
  page,
  perPage,
  search,
}: GetParams): Promise<Funcoes> {
  try {
    const response = await api.get(
      `/api/funcoes/get?page=${page}&perPage=${perPage}&search=${search}`,
    );

    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar funções:', error.message || error);
    throw new Error('Erro ao buscar funções. Tente novamente mais tarde.');
  }
}

/**
 * Busca Todas as Funções (sem paginação)
 */
export async function getTodasFuncoes(): Promise<Funcao[]> {
  try {
    const response = await api.get('/api/funcoes/todas');
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar todas as funções:', error.message || error);
    throw new Error(
      'Erro ao buscar todas as funções. Tente novamente mais tarde.',
    );
  }
}

/**
 * Inserir Nova Função
 */
export async function insertFuncao(funcao: {
  descricao: string;
  sigla: string;
  usadoEm: string;
}): Promise<void> {
  try {
    const response = await api.post('/api/funcoes/add', funcao);

    if (!response || response.status !== 201) {
      throw new Error('Erro ao inserir a função.');
    }
  } catch (error: any) {
    console.error('Erro ao inserir função:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao inserir a função. Verifique os dados e tente novamente.',
    );
  }
}

/**
 * Buscar Função por ID
 */
export async function getFuncao(id: number): Promise<Funcao> {
  try {
    const response = await api.get(`/api/funcoes/get/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar função:', error.message || error);
    throw new Error('Erro ao buscar a função. Tente novamente mais tarde.');
  }
}

/**
 * Atualizar Função
 */
export async function updateFuncao(funcao: Funcao): Promise<void> {
  try {
    const response = await api.put('/api/funcoes/update', funcao);

    if (!response || response.status !== 200) {
      throw new Error('Erro ao atualizar a função.');
    }
  } catch (error: any) {
    console.error('Erro ao atualizar função:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao atualizar a função. Verifique os dados e tente novamente.',
    );
  }
}

/**
 * Deletar Função por ID
 */
export async function deletarFuncao(id: number): Promise<void> {
  try {
    const response = await api.delete(`/api/funcoes/delete/${id}`);

    if (!response || response.status !== 200) {
      throw new Error('Erro ao deletar a função.');
    }
  } catch (error: any) {
    console.error('Erro ao deletar função:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao deletar a função. Verifique se a função existe e tente novamente.',
    );
  }
}
/**
 * Busca funções associadas a um perfil específico.
 * @param perfilName Nome do perfil (login_perfil_name).
 * @returns Lista de funções (Funcao[]).
 */
export async function buscarFuncoesPerfil(
  perfilName: string,
): Promise<Funcao[]> {
  try {
    const response = await api.get(
      `/api/funcoes/perfil/${encodeURIComponent(perfilName)}`,
    );
    return response.data.data as Funcao[];
  } catch (error: any) {
    console.error(
      `Erro ao buscar funções do perfil ${perfilName}:`,
      error.message || error,
    );
    throw new Error(
      'Erro ao buscar funções do perfil. Tente novamente mais tarde.',
    );
  }
}

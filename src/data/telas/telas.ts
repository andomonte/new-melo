import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface Tela {
  CODIGO_TELA: number;
  NOME_TELA: string;
  PATH_TELA: string;
}

export interface Telas {
  data: Tela[];
  meta: Meta;
}

export async function getTelas({
  page,
  perPage,
  search,
}: GetParams): Promise<Telas> {
  try {
    const response = await api.get(
      `/api/telas/get?page=${page}&perPage=${perPage}&search=${search}`,
    );
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar telas:', error.message || error);
    throw new Error('Erro ao buscar telas. Tente novamente mais tarde.');
  }
}

export async function getTodasTelas(): Promise<Tela[]> {
  try {
    const response = await api.get('/api/telas/todas');
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar todas as telas:', error.message || error);
    throw new Error(
      'Erro ao buscar todas as telas. Tente novamente mais tarde.',
    );
  }
}

export async function insertTela(
  tela: Omit<Tela, 'CODIGO_TELA'>,
): Promise<void> {
  try {
    const response = await api.post('/api/telas/add', tela);
    if (!response || response.status !== 201) {
      throw new Error('Erro ao inserir a tela.');
    }
  } catch (error: any) {
    console.error('Erro ao inserir tela:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao inserir a tela. Verifique os dados e tente novamente.',
    );
  }
}

export async function getTela(id: number): Promise<Tela> {
  try {
    const response = await api.get(`/api/telas/get/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar tela:', error.message || error);
    throw new Error('Erro ao buscar a tela. Tente novamente mais tarde.');
  }
}

export async function updateTela(tela: Tela): Promise<void> {
  try {
    const response = await api.put(`/api/telas/update`, tela);
    if (!response || response.status !== 200) {
      throw new Error('Erro ao atualizar a tela.');
    }
  } catch (error: any) {
    console.error('Erro ao atualizar tela:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao atualizar a tela. Verifique os dados e tente novamente.',
    );
  }
}

export async function deletarTela(id: number): Promise<void> {
  try {
    const response = await api.delete(`/api/telas/delete/${id}`);
    if (!response || response.status !== 200) {
      throw new Error('Erro ao deletar a tela.');
    }
  } catch (error: any) {
    console.error('Erro ao deletar tela:', error.message || error);
    throw new Error(
      error.response?.data?.message ||
        'Erro ao deletar a tela. Verifique se a tela existe e tente novamente.',
    );
  }
}

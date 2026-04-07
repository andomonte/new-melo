import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface Filial {
  codigo_filial: number;
  nome_filial: string;
}

export interface Filiais {
  data: Filial[];
  meta: Meta;
}

export async function getFiliais({
  page,
  perPage,
  search,
}: GetParams): Promise<Filiais> {
  let filiais: Filiais = {} as Filiais;

  await api
    .get(`/api/filiais/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      filiais = response.data;
    });

  return filiais;
}

export async function insertFilial(filial: Filial): Promise<void> {
  await api.post('/api/filiais/add', filial);
}

export async function getFilial(id: string): Promise<Filial> {
  let filial: Filial = {} as Filial;

  await api.get(`/api/filiais/get/${id}`).then((response) => {
    filial = response.data;
  });

  return filial;
}

export async function updateFilial(filial: Filial): Promise<void> {
  await api.put(`/api/filiais/update`, filial);
}

export async function deletarFilial(id: number): Promise<void> {
  try {
    await api.delete(`/api/filiais/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar filial na camada de dados:', error);
    // Rejeite a promessa para que o erro seja capturado no componente
    throw error;
  }
}

export interface TodasFiliaisResponse {
  data: Filial[];
}

export async function getTodasFiliais(): Promise<TodasFiliaisResponse> {
  let todasFiliais: TodasFiliaisResponse = { data: [] };

  await api.get(`/api/filiais/get/todasFiliais`).then((response) => {
    todasFiliais = response.data;
  });

  return todasFiliais;
}

import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface Banco {
  banco?: string;
  nome: string;
}

export interface Bancos {
  data: Banco[];
  meta: Meta;
}

export async function getBancos({
  page,
  perPage,
  search,
}: GetParams): Promise<Bancos> {
  let bancos: Bancos = {} as Bancos;

  await api
    .get(`/api/bancos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      bancos = response.data;
    });

  return bancos;
}

export async function insertBanco(banco: Banco): Promise<Banco> {
  const response = await api.post('/api/bancos/add', banco);
  return response.data.data;
}

export async function getBanco(id: string): Promise<Banco> {
  let banco: Banco = {} as Banco;

  await api.get(`/api/bancos/get/${id}`).then((response) => {
    banco = response.data;
  });

  return banco;
}

export async function updateBanco(banco: Banco): Promise<void> {
  await api.put(`/api/bancos/update`, banco);
}

export async function deletarBanco(id: string): Promise<void> {
  try {
    await api.delete(`/api/bancos/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar banco na camada de dados:', error); // Rejeite a promessa para que o erro seja capturado no componente
    throw error;
  }
}

export interface TodosBancosResponse {
  data: Banco[];
}

export async function getTodosBancos(): Promise<TodosBancosResponse> {
  let todosBancos: TodosBancosResponse = { data: [] };

  await api.get(`/api/bancos/get/todosBancos`).then((response) => {
    todosBancos = response.data;
  });

  return todosBancos;
}

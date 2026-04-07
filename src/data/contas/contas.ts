// src/data/contas/contas.ts

import { Meta } from '../common/meta'; // Assumindo que Meta e GetParams estão em 'common'
import { GetParams } from '../common/getParams';
import api from '@/components/services/api'; // Seu serviço Axios

export interface Conta {
  id: number;
  banco?: string;
  tipo?: string;
  nroconta?: string;
  convenio?: string;
  variacao?: string;
  carteira?: string;
  melo?: string;
  agencia?: string;
  status?: string;
}

export interface ContasResponse {
  data: Conta[];
  meta: Meta;
}

export interface TodosContasResponse {
  data: Conta[];
}
// src/data/contas/contas.ts (continuando do código acima)

// ... (interfaces Conta, ContasResponse, TodosContasResponse)

export async function getContas({
  page,
  perPage,
  search,
  banco,
}: GetParams & { banco?: string }): Promise<ContasResponse> {
  let contas: ContasResponse = {} as ContasResponse;

  const bancoParam = banco ? `&banco=${banco}` : '';
  await api
    .get(`/api/contas/get?page=${page}&perPage=${perPage}&search=${search}${bancoParam}`)
    .then((response) => {
      contas = response.data;
    });

  return contas;
}

export async function insertConta(conta: Omit<Conta, 'id'>): Promise<void> {
  // Usamos Omit<Conta, 'id'> pois o 'id' é geralmente gerado pelo banco de dados na inserção
  await api.post('/api/contas/add', conta);
}

export async function getConta(id: string): Promise<Conta> {
  let conta: Conta = {} as Conta;

  await api.get(`/api/contas/get/${id}`).then((response) => {
    conta = response.data.data; // Ajuste aqui: a API get geralmente retorna { data: {...} }
  });

  return conta;
}

export async function updateConta(conta: Conta): Promise<void> {
  // Extrai o id e os demais dados do objeto 'conta'
  const { id, ...updateData } = conta;

  // Verifica se o ID existe antes de fazer a requisição
  if (typeof id === 'undefined' || id === null) {
    throw new Error("ID da conta é obrigatório para atualização.");
  }

  // O endpoint PUT do seu backend espera o ID na URL (query parameter)
  // e os dados a serem atualizados no corpo da requisição.
  await api.put(`/api/contas/update?id=${id}`, updateData);
  //                               ^          ^
  //                               |          |
  //             ID na URL (query param)      Restante dos dados no corpo
}

export async function deletarConta(id: string): Promise<void> {
  try {
    await api.delete(`/api/contas/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar conta na camada de dados:', error);
    throw error;
  }
}

// Se você tiver uma API para buscar todas as contas sem paginação/filtro
export async function getTodasContas(): Promise<TodosContasResponse> {
  let todasContas: TodosContasResponse = { data: [] };

  await api.get(`/api/contas/get/todasContas`).then((response) => {
    todasContas = response.data;
  });

  return todasContas;
}
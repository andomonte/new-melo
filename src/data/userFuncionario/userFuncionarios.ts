import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

// Interface para um único registro da tabela tb_user_perfil
// Os campos foram ajustados para corresponder à nova tabela
export interface UserPerfil {
  user_login_id: string;
  perfil_name: string;
  codigo_filial: number;
  nome_filial?: string;
  codvend?: string;
  codcomprador?: string;
}

// Interface para o retorno da API com paginação
export interface UserPerfis {
  data: UserPerfil[];
  meta: Meta;
}

// Interface para o retorno da API sem paginação
export interface TodosUserPerfisResponse {
  data: UserPerfil[];
}

// --- Interfaces e funções para a edição do usuário ---
// Esta é a parte que faltava ou estava incorreta.
export interface LoginAccessUser {
  id_functions: number;
  login_user_login: string;
  login_perfil_name: string;
  codigo_filial: number;
  codvend?: string;
  codcomprador?: number;
}

export async function updateLoginAccessUser(
  user: LoginAccessUser,
): Promise<void> {
  try {
    await api.put(`/api/userFuncionarios/updateLoginAccess`, user);
  } catch (error) {
    console.error('Erro ao atualizar LoginAccessUser:', error);
    throw error;
  }
}

// --- Funções originais ---

export async function getUserPerfis({
  page,
  perPage,
  search,
}: GetParams): Promise<UserPerfis> {
  let userFuncionarios: UserPerfis = {} as UserPerfis;

  await api
    .get(
      `/api/userFuncionarios/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      userFuncionarios = response.data;
    });

  return userFuncionarios;
}

export async function getUserPerfil(
  user_login_id: string,
  perfil_name: string,
  codigo_filial: number,
): Promise<UserPerfil> {
  let userPerfil: UserPerfil = {} as UserPerfil;

  await api
    .get(
      `/api/userFuncionarios/get/${user_login_id}/${perfil_name}/${codigo_filial}`,
    )
    .then((response) => {
      userPerfil = response.data;
    });

  return userPerfil;
}

export async function insertUserPerfil(perfil: UserPerfil): Promise<void> {
  await api.post('/api/userFuncionarios/add', perfil);
}

export async function updateUserPerfil(perfil: UserPerfil): Promise<void> {
  await api.put(`/api/userFuncionarios/update`, perfil);
}

export async function deletarUserPerfil(
  user_login_id: string,
  perfil_name: string,
  codigo_filial: number,
): Promise<void> {
  try {
    await api.delete(
      `/api/userFuncionarios/delete/${user_login_id}/${perfil_name}/${codigo_filial}`,
    );
  } catch (error: any) {
    console.error('Erro ao deletar o registro:', error);
    throw error;
  }
}

export async function getTodosUserPerfis(): Promise<TodosUserPerfisResponse> {
  let todosUserPerfis: TodosUserPerfisResponse = { data: [] };

  await api
    .get(`/api/userFuncionarios/get/todosUserPerfis`)
    .then((response) => {
      todosUserPerfis = response.data;
    });

  return todosUserPerfis;
}

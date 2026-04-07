import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface TodosPerfisResponse {
  data: { login_perfil_name: string }[];
}
export async function getTodosPerfis(): Promise<TodosPerfisResponse> {
  let todosPerfis: TodosPerfisResponse = { data: [] };

  await api.get(`/api/perfis/get/perfilTotal`).then((response) => {
    todosPerfis = response.data;
  });

  return todosPerfis;
}
export interface Perfil {
  login_perfil_name: string;
  qtd_telas: number;
  qtd_usuarios: number;
  qtd_functions: number;
  grupos?: {
    telas: { label: string; value: number }[];
    permissoes: { label: string; value: string }[];
    funcoes: { label: string; value: number }[];
  }[];
}
export interface PerfilCompleto {
  login_perfil_name: string;
  telasPermissoes: {
    CODIGO_TELA: number;
    NOME_TELA: string; // Adicionei o nome da tela aqui para facilitar o uso
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    exportar: boolean;
  }[];
  funcoes: number[]; // Apenas um array de IDs de funções
  usuarios: { login_user_login: string }[];
}

export interface PerfilCadastroOuEdicao {
  login_perfil_name: string;
  grupos: {
    telas: { label: string; value: number }[];
    permissoes: { label: string; value: string }[];
    funcoes: { label: string; value: number }[];
  }[];
}
export interface Perfis {
  data: Perfil[];
  meta: Meta;
}

export async function getPerfis({
  page,
  perPage,
  search,
}: GetParams): Promise<Perfis> {
  let perfis: Perfis = {} as Perfis;

  await api
    .get(`/api/perfis/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      perfis = response.data;
    });

  return perfis;
}

export async function insertPerfil(
  perfil: Omit<Perfil, 'qtd_telas' | 'qtd_usuarios' | 'qtd_functions'>,
): Promise<void> {
  await api.post('/api/perfis/add', perfil);
}

export async function getPerfil(id: string): Promise<PerfilCompleto> {
  let perfil: PerfilCompleto = {} as PerfilCompleto;

  await api.get(`/api/perfis/get/${id}`).then((response) => {
    perfil = response.data;
  });

  return perfil;
}

export async function updatePerfil(
  perfil: PerfilCadastroOuEdicao,
): Promise<void> {
  await api.put(`/api/perfis/update`, perfil);
}
export interface Option {
  label: string;
  value: string | number;
}

export interface GrupoPerfil {
  nomePerfil: string;
  telas: Option[];
  permissoes: Option[];
  funcoes: Option[];
}

export interface PerfilDados {
  login_perfil_name: string;
  grupos: GrupoPerfil[];
}
export interface PerfilAtualizacao {
  login_perfil_name: string;
  grupos: {
    nomePerfil: string;
    telas: {
      tela: { value: number; label: string };
      permissoes: {
        cadastrar: boolean;
        editar: boolean;
        remover: boolean;
        exportar: boolean;
      };
    }[];
    funcoes: { value: number; label: string }[];
  }[];
}
export async function deletarPerfil(id: string): Promise<void> {
  try {
    await api.delete(`/api/perfis/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar perfil na camada de dados:', error);
    // Rejeite a promessa para que o erro seja capturado no componente
    throw error;
  }
}

import { Meta } from '../common/meta';
import { Armazem } from '../armazem/armazens'; // Manter a importação de Armazem

export interface Funcao {
  id_functions: number;
  descricao: string;
  sigla?: string | null;
  usadoEm?: string | null;
  codigo_filial?: number;
}

export interface Perfil {
  perfil_name?: string;
  filial: {
    codigo_filial: string;
    nome_filial: string;
    codvend?: string | null;
    armazens?: Armazem[];
  }[];
  funcoesPadraoPerfil?: Funcao[];
  funcoesDoUsuario?: Funcao[]; // Revertido para o nível do Perfil
}

interface Resposta {
  login_user_login: string;
  login_user_name: string;
  perfis?: Perfil[];
  codvend?: string | null;
}

export interface Usuario {
  data: Resposta[];
  meta: Meta;
}

export interface UsuarioEdit {
  login_user_login: string;
  login_user_name: string;
  login_user_password?: string;
  login_group_name?: string;
  login_user_obs?: string;
  codvend?: string | null;
  perfis: {
    perfil_name: string;
    filial: {
      codigo_filial: string;
      nome_filial: string;
      codvend?: string | null;
      armazens?: Armazem[];
      funcoesDoUsuario: Funcao[]; // Revertido para o nível do Perfil
    }[];
    funcoesPadraoPerfil: Funcao[];
  }[];
  filiais?: { codigo_filial: string }[];
  funcoesUsuario?: number[];
}

// ✅ CORREÇÃO: ADICIONADA A INTERFACE UsuariosGetParams
export interface UsuariosGetParams {
  page?: number;
  perPage?: number;
  search?: string;
  grupo?: string;
}

export async function getUsuarios({
  page = 1,
  perPage = 10,
  search = '',
  grupo,
}: UsuariosGetParams): Promise<Usuario> {
  try {
    const response = await fetch(
      `/api/usuarios/get?page=${page}&perPage=${perPage}&search=${search}&grupo=${grupo}`,
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar usuários:', error);
      throw new Error(error.message || 'Erro ao buscar usuários.');
    }

    const data = await response.json();

    return {
      data: data.data ?? [],
      meta: data.meta ?? {
        currentPage: 1,
        perPage: 10,
        total: 0,
        totalPages: 1,
      },
    };
  } catch (error: any) {
    console.error('Erro ao buscar usuários:', error);
    throw error;
  }
}

export async function deletarUsuario(id: string): Promise<void> {
  try {
    const response = await fetch(
      `/api/usuarios/deletar/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao deletar usuário:', error);
      throw new Error(error.message || 'Erro ao deletar usuário.');
    }
  } catch (error: any) {
    console.error('Erro ao deletar usuário:', error);
    throw error;
  }
}

export async function atualizarUsuario(
  id: string,
  data: UsuarioEdit,
): Promise<void> {
  try {
    const response = await fetch(
      `/api/usuarios/update/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao atualizar usuário:', error);
      throw new Error(error.message || 'Erro ao atualizar usuário.');
    }
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    throw error;
  }
}

export async function criarUsuario(data: UsuarioEdit): Promise<void> {
  try {
    const response = await fetch('/api/usuarios/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao criar usuário:', error);
      throw new Error(error.message || 'Erro ao criar usuário.');
    }
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
}

export async function resetarSenha(id: string): Promise<void> {
  try {
    const response = await fetch(
      `/api/usuarios/reset/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao resetar senha:', error);
      throw new Error(error.message || 'Erro ao resetar senha.');
    }
  } catch (error: any) {
    console.error('Erro ao resetar senha:', error);
    throw error;
  }
}

// Alias para criarUsuario (compatibilidade com modalCadastrar.tsx)
export const insertUsuario = criarUsuario;

// Função para buscar um único usuário
export async function getUsuario(id: string): Promise<UsuarioEdit> {
  try {
    const response = await fetch(`/api/usuarios/get/${encodeURIComponent(id)}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar usuário:', error);
      throw new Error(error.message || 'Erro ao buscar usuário.');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Erro ao buscar usuário:', error);
    throw error;
  }
}

// Alias para atualizarUsuario (compatibilidade com modalEditar.tsx)
export const updateUsuario = atualizarUsuario;

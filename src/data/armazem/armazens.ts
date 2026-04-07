// src/data/armazem/armazens.ts

import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

// --- Interface Armazem Atualizada ---
// Esta interface agora inclui todos os novos campos da sua tabela dbarmazem.
// É essencial que ela reflita a estrutura completa do dado que você espera receber/enviar.
export interface Armazem {
  id_armazem: number;
  nome: string | null; // Pode ser null no banco de dados, então tipamos como tal
  filial: string | null; // Pode ser null no banco de dados
  ativo: boolean | null; // Pode ser null no banco de dados, default é true
  data_cadastro: string | null; // Retornado como string pelo driver do PG para Date/Timestamp
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  inscricaoestadual: string | null; // <-- NOVA COLUNA ADICIONADA AQUI
}

export interface Armazens {
  data: Armazem[];
  meta: Meta;
}

// A função getArmazens já lida com 'SELECT *', então a tipagem 'Armazem[]' já funcionará.
export async function getArmazens({
  page,
  perPage,
  search,
}: GetParams): Promise<Armazens> {
  let armazens: Armazens = { data: [], meta: {} as Meta }; // Inicialização mais segura

  await api
    .get(`/api/armazem/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      armazens = response.data;
    });

  return armazens;
}

// --- Função insertArmazem Atualizada ---
// O parâmetro 'armazem' agora pode incluir todos os campos para criação,
// exceto 'id_armazem' e 'data_cadastro' que são gerados pelo backend/banco.
export async function insertArmazem(
  armazem: Omit<Partial<Armazem>, 'id_armazem' | 'data_cadastro' | 'filial'> & {
    nome: string;
  },
): Promise<void> {
  // 'nome' é explicitamente obrigatório aqui como era antes.
  // 'filial' é adicionado automaticamente no backend via cookie, então não é enviado aqui.
  // Omit<Partial<Armazem>, ...> permite que todos os outros campos sejam opcionais para a inserção.
  await api.post('/api/armazem/add', armazem);
}

// A função getArmazem já funciona com o tipo 'number' para o ID e 'Armazem' para o retorno.
export async function getArmazem(id: number): Promise<Armazem> {
  let armazem: Armazem = {} as Armazem; // Inicialização

  await api.get(`/api/armazem/get/${id}`).then((response) => {
    armazem = response.data.data; // Assumindo que a resposta do GET de um único item vem em { data: Armazem }
  });

  return armazem;
}

// --- Função updateArmazem Atualizada ---
// O parâmetro 'armazem' agora pode incluir todos os campos para atualização.
// 'Partial<Armazem>' permite que você envie apenas os campos que deseja atualizar (para PATCH).
export async function updateArmazem(
  armazem: Partial<Armazem> & { id_armazem: number },
): Promise<void> {
  // id_armazem é obrigatório para identificar qual armazém atualizar.
  // Todos os outros campos são opcionais, permitindo atualizações parciais.
  await api.put(`/api/armazem/update`, armazem); // Endpoint /api/armazem/update foi o que ajustamos para PUT/PATCH
}

// A função deletarArmazem já funciona com o tipo 'number' para o ID.
export async function deletarArmazem(id: number): Promise<void> {
  try {
    await api.delete(`/api/armazem/delete/${id}`);
  } catch (error: any) {
    console.error('Erro ao deletar armazém na camada de dados:', error);
    throw error;
  }
}

export interface TodosArmazensResponse {
  data: Armazem[];
}

// A função getTodosArmazens já funciona com o tipo 'Armazem[]'.
export async function getTodosArmazens(
  login_user_login: string,
  grupoId?: string,
): Promise<TodosArmazensResponse> {
  const params = new URLSearchParams();
  params.append('login_user_login', login_user_login);
  if (grupoId) params.append('grupoId', grupoId);

  const response = await api.get(
    `/api/armazensUsuario/buscarArmazens?${params.toString()}`,
  );

  return response.data;
}
/**
 * Busca os armazéns associados a um determinado perfil.
 * @param perfilName Nome do perfil (login_perfil_name)
 * @returns Lista de armazéns (Armazem[])
 */
export async function buscarArmazensPerfil(
  perfilName: string,
): Promise<Armazem[]> {
  try {
    const response = await api.get(
      `/api/armazem/perfil/${encodeURIComponent(perfilName)}`,
    );
    return response.data.data as Armazem[];
  } catch (error: any) {
    console.error(`Erro ao buscar armazéns do perfil ${perfilName}:`, error);
    throw error;
  }
}

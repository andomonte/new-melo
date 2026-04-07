// src/data/dadosEmpresa/dadosEmpresas.ts

import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

// --- Interfaces para DadosEmpresa ---
export interface DadosEmpresa {
  cgc: string;
  inscricaoestadual?: string | null;
  nomecontribuinte?: string | null;
  municipio?: string | null;
  uf?: string | null;
  fax?: string | null;
  codigoconvenio?: string | null;
  codigonatureza?: string | null;
  codigofinalidade?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  contato?: string | null;
  telefone?: string | null;
  suframa?: string | null;
  email?: string | null;
  inscricaoestadual_07?: string | null;
  inscricaomunicipal?: string | null;
  id_token?: string | null;
  token?: string | null;
  certificadoKey?: string | null;
  certificadoCrt?: string | null;
  cadeiaCrt?: string | null;
  // Adicione data_cadastro aqui SE você espera que ele exista para DadosEmpresa
  // data_cadastro?: string | null; // <-- Adicionar se for um campo válido para DadosEmpresa
}

export interface DBDadosEmpresa {
  cgc: string;
  inscricaoestadual: string | null;
  nomecontribuinte: string | null;
  municipio: string | null;
  uf: string | null;
  fax: string | null;
  codigoconvenio: string | null;
  codigonatureza: string | null;
  codigofinalidade: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  contato: string | null;
  telefone: string | null;
  suframa: string | null;
  email: string | null;
  inscricaoestadual_07: string | null;
  inscricaomunicipal: string | null;
  id_token: string | null;
  token: string | null;
  certificadoKey: string | null;
  certificadoCrt: string | null;
  cadeiaCrt: string | null;
  // Adicione data_cadastro aqui se ele existe no DB
  // data_cadastro: string | null;
}

export interface DadosEmpresaListResponse {
  data: DadosEmpresa[];
  meta: Meta;
}

export interface AllDadosEmpresasListResponse {
  data: DadosEmpresa[];
}

// Função para buscar múltiplos registros de dados de empresa (listagem)
export async function getDadosEmpresas({
  page,
  perPage,
  search,
}: GetParams): Promise<DadosEmpresaListResponse> {
  let dadosEmpresas: DadosEmpresaListResponse = { data: [], meta: {} as Meta };

  try {
    // AJUSTADO: Usando o padrão /get para listar múltiplos como em armazem
    const response = await api.get(
      `/api/dadosEmpresa/get?page=${page}&perPage=${perPage}&search=${search}`,
    );
    dadosEmpresas = response.data;
  } catch (error: any) {
    console.error('Erro ao buscar dados de empresas:', error);
    throw error;
  }

  return dadosEmpresas;
}

// Função para inserir um novo registro de dados de empresa
export async function insertDadosEmpresa(
  dados: Omit<Partial<DadosEmpresa>, 'cgc'> & { cgc: string },
): Promise<void> {
  try {
    // AJUSTADO: Endpoint para /api/dadosEmpresa/add
    await api.post('/api/dadosEmpresa/add', dados);
  } catch (error: any) {
    console.error('Erro ao inserir dados da empresa:', error);
    throw error;
  }
}

// Função para buscar um único registro de dados de empresa por CGC
export async function getDadosEmpresaByCgc(cgc: string): Promise<DadosEmpresa> {
  let dadosEmpresa: DadosEmpresa = {} as DadosEmpresa;

  try {
    // CORRIGIDO: Usando a rota correta /api/dadosEmpresa/[cgc] que aceita GET
    const response = await api.get(`/api/dadosEmpresa/${cgc}`);
    // A resposta vem diretamente o objeto
    dadosEmpresa = response.data;
  } catch (error: any) {
    console.error(`Erro ao buscar dados da empresa com CGC ${cgc}:`, error);
    throw error;
  }

  return dadosEmpresa;
}

// Função para atualizar um registro de dados de empresa
export async function updateDadosEmpresa(
  dados: Partial<DadosEmpresa> & { cgc: string },
): Promise<void> {
  try {
    // AJUSTADO: Usando o padrão /update para atualizar como em armazem
    await api.put(`/api/dadosEmpresa/update`, dados);
  } catch (error: any) {
    console.error(
      `Erro ao atualizar dados da empresa com CGC ${dados.cgc}:`,
      error,
    );
    throw error;
  }
}

// Função para deletar um registro de dados de empresa
export async function deletarDadosEmpresa(cgc: string): Promise<void> {
  try {
    // CORRIGIDO: Usando a rota correta /api/dadosEmpresa/[cgc] que aceita DELETE
    await api.delete(`/api/dadosEmpresa/${cgc}`);
  } catch (error: any) {
    console.error(`Erro ao deletar dados da empresa com CGC ${cgc}:`, error);
    throw error;
  }
}

// Função para buscar TODOS os registros de dados de empresa SEM paginação
export async function getAllDadosEmpresas(): Promise<DadosEmpresa[]> {
  let dadosEmpresas: DadosEmpresa[] = [];
  try {
    // AJUSTADO: Usando o padrão /get/todos para listar todos como em armazem
    const response = await api.get(
      '/api/dadosEmpresa/listarTodasDadosEmpresas',
    );
    dadosEmpresas = response.data.data || response.data;
  } catch (error: any) {
    console.error(
      'Erro ao buscar todos os dados de empresas (sem paginação):',
      error,
    );
    throw error;
  }
  return dadosEmpresas;
}

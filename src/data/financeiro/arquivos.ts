// src/data/financeiro/arquivos.ts
//
// Camada de acesso das telas de "Financeiro > Arquivos". Todos os cadastros
// falam com /api/financeiro/arquivos/<recurso> com o mesmo contrato, então uma
// fábrica basta — cada tela só declara o seu recurso e o seu tipo.

import api from '@/components/services/api';
import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage';

export interface ListaPaginada<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiArquivo<T> {
  listar: (params: GetParams) => Promise<ListaPaginada<T>>;
  obter: (id: string | number) => Promise<T>;
  criar: (dados: T) => Promise<T>;
  atualizar: (id: string | number, dados: T) => Promise<T>;
  excluir: (id: string | number) => Promise<void>;
}

export function criarApiArquivo<T>(recurso: string): ApiArquivo<T> {
  const base = `/api/financeiro/arquivos/${recurso}`;

  return {
    // A listagem vai por POST (mesmo padrão do /api/cfop) para caber os
    // filtros por coluna do DataTable.
    listar: async ({ page = 1, perPage = 10, search = '', filtros = [] }) => {
      const { data } = await api.post(base, { page, perPage, search, filtros });
      return data;
    },
    obter: async (id) => {
      const { data } = await api.get(`${base}/${encodeURIComponent(String(id))}`);
      return data;
    },
    criar: async (dados) => {
      const { data } = await api.post(base, dados);
      return data;
    },
    atualizar: async (id, dados) => {
      const { data } = await api.put(
        `${base}/${encodeURIComponent(String(id))}`,
        dados,
      );
      return data;
    },
    excluir: async (id) => {
      await api.delete(`${base}/${encodeURIComponent(String(id))}`);
    },
  };
}

/** Adapta a fábrica ao formato esperado pelo GenericCrudPage. */
export function paraCrudApi<T>(recurso: string) {
  const a = criarApiArquivo<T>(recurso);
  return {
    list: a.listar,
    getById: a.obter,
    create: a.criar,
    update: a.atualizar,
    remove: a.excluir,
  };
}

// ---------------------------------------------------------------------------
// Tipos dos cadastros (espelham as colunas das tabelas do Oracle/Postgres)
// ---------------------------------------------------------------------------

/** DBCOMPRADORES */
export interface Comprador {
  codcomprador?: string;
  nome: string;
}

/** DBCCUSTO */
export interface CentroCusto {
  cod_ccusto?: string;
  descr: string;
  tipo: string; // 'A' = Ativo, 'P' = Passivo
}

/** DBUF_N */
export interface UnidadeFederacao {
  uf: string;
  st: string; // S/N — situação tributária
  zona_isentivada: string; // S/N
  icms_antecipado: string; // S/N
  icmsinterno: number | string;
  icmsexterno: number | string;
  icmscorredor: number | string;
}

/** DBBANCOCENTRAL */
export interface BancoCentral {
  codbc: string;
  descr: string;
}

/** DBBANCO (agências) */
export interface Agencia {
  cod_banco?: string;
  cod_bc: string;
  codbc?: string;
  banco_central?: string;
  nome: string;
  n_agencia: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  contatos: string;
}

/** DBCONTA */
export interface ContaBancaria {
  cod_conta?: string;
  cod_banco: string;
  agencia?: string;
  n_agencia?: string;
  nro_conta: string;
  digito: string;
  oficial: string; // S = Oficial, N = Não Oficial
}

/** dbservico_nfs (SEN_* do Delphi) */
export interface ServicoNfs {
  sen_id?: string;
  sen_codigo: string;
  sen_cnae: string;
  sen_codunico?: string;
  sen_atividade: string;
  sen_issqn: number | string;
  sen_codgpc: string;
  gpcontabil?: string;
  sen_excluido?: number;
}

/** tb_user_perfil.cod_conta */
export interface OperadorCaixa {
  id?: string; // usuario|perfil|codigo_filial
  usuario: string;
  perfil: string;
  codigo_filial: number | string;
  filial?: string;
  cod_conta: string;
  nro_conta?: string;
  digito?: string;
}

// ---------------------------------------------------------------------------
// Lookups (equivalentes aos botões "..." de consulta do Delphi)
// ---------------------------------------------------------------------------

export async function buscarBancosCentrais(search = ''): Promise<BancoCentral[]> {
  const { data } = await api.post('/api/financeiro/arquivos/bancos-centrais', {
    page: 1,
    perPage: 200,
    search,
    filtros: [],
  });
  return data.data ?? [];
}

export async function buscarAgencias(search = ''): Promise<Agencia[]> {
  const { data } = await api.post('/api/financeiro/arquivos/agencias', {
    page: 1,
    perPage: 200,
    search,
    filtros: [],
  });
  return data.data ?? [];
}

export async function buscarContas(
  search = '',
): Promise<{ cod_conta: string; nro_conta: string }[]> {
  const { data } = await api.get('/api/contas-caixa/get', {
    params: { search },
  });
  return data.data ?? [];
}

export async function buscarGruposContabeis(
  search = '',
): Promise<{ codgpc: string; descr: string }[]> {
  const { data } = await api.get('/api/gruposContabil/get', {
    params: { search, page: 1, perPage: 200 },
  });
  return data.data ?? [];
}

export async function buscarUsuariosPerfil(
  search = '',
): Promise<OperadorCaixa[]> {
  const { data } = await api.get('/api/financeiro/arquivos/usuarios-perfil', {
    params: { search },
  });
  return data.data ?? [];
}

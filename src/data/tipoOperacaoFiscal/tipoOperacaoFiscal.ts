import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage';
import api from '@/components/services/api';

export interface TipoOperacaoFiscal {
  id?: number;
  codigo: string;
  descricao: string;
  tipo_movimentacao: string;
  ordem?: number;
  ativo?: boolean;
}

export type Meta = PaginationMeta;

export interface TiposOperacaoFiscal {
  data: TipoOperacaoFiscal[];
  meta: Meta;
}

export interface MovimentacaoOption {
  codigo: string;
  descricao: string;
}

const BASE = '/api/tipoOperacaoFiscal';

export async function getTiposOperacaoFiscal({
  page,
  perPage,
  search,
  filtros,
}: GetParams): Promise<TiposOperacaoFiscal> {
  const response = await api.post(BASE, {
    page,
    perPage,
    search: search || '',
    filtros: filtros || [],
  });
  return response.data;
}

export async function getTipoOperacaoFiscal(
  id: string | number,
): Promise<TipoOperacaoFiscal> {
  const response = await api.get(`${BASE}/${id}`);
  return response.data;
}

export async function createTipoOperacaoFiscal(
  data: TipoOperacaoFiscal,
): Promise<TipoOperacaoFiscal> {
  const response = await api.post(BASE, data);
  return response.data;
}

export async function updateTipoOperacaoFiscal(
  data: TipoOperacaoFiscal,
): Promise<TipoOperacaoFiscal> {
  const response = await api.put(`${BASE}/${data.id}`, data);
  return response.data;
}

export async function deleteTipoOperacaoFiscal(
  id: string | number,
): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function getMovimentacoes(): Promise<MovimentacaoOption[]> {
  const response = await api.get(`${BASE}/movimentacoes`);
  return response.data;
}

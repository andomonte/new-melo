// src/data/operadoras/operadoraCrud.ts
// Data layer do CRUD de Operadora de Cartão (tela de cadastro), via /api/cadastro-operadoras.
import { GetParams } from '../common/getParams';
import { PaginationMeta } from '@/components/common/genericCrudPage';
import api from '@/components/services/api';

export interface OperadoraCartao {
  codopera: string;
  descr: string;
  txopera?: number | string | null; // taxa (%)
  pzopera?: number | string | null; // prazo (dias)
  cond_pagto?: string | null;
  codcli?: string | null;
  desativado?: number | string | null; // 0 = ativo
  nome_cliente?: string | null;
}

export type Meta = PaginationMeta;

export interface OperadorasResp {
  data: OperadoraCartao[];
  meta: Meta;
}

export async function getOperadorasCrud({
  page,
  perPage,
  search,
  filtros,
}: GetParams): Promise<OperadorasResp> {
  const response = await api.post('/api/cadastro-operadoras', {
    page,
    perPage,
    search: search || '',
    filtros: filtros || [],
  });
  return response.data;
}

export async function getOperadoraCrud(id: string | number): Promise<OperadoraCartao> {
  const response = await api.get(`/api/cadastro-operadoras/${id}`);
  return response.data;
}

export async function createOperadoraCrud(data: OperadoraCartao): Promise<OperadoraCartao> {
  const response = await api.post('/api/cadastro-operadoras', data);
  return response.data;
}

export async function updateOperadoraCrud(data: OperadoraCartao): Promise<OperadoraCartao> {
  const response = await api.put(`/api/cadastro-operadoras/${data.codopera}`, data);
  return response.data;
}

export async function deleteOperadoraCrud(id: string | number): Promise<void> {
  await api.delete(`/api/cadastro-operadoras/${id}`);
}

/** Ativa/inativa sem abrir o formulário (desativado: 0 = ativo, 1 = inativo). */
export async function setSituacaoOperadora(
  codopera: string,
  desativado: number,
): Promise<void> {
  await api.patch(`/api/cadastro-operadoras/${codopera}`, { desativado });
}

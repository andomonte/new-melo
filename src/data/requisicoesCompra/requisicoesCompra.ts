import api from '@/components/services/api';
import type { RequisitionDTO, RequisitionStatus, OrderStatus } from './types/requisition';
import type { Meta } from '../common/meta';
import type { GetParams } from '../common/getParams';

export interface RequisicoesCompraResponse {
  data: RequisitionDTO[];
  meta: Meta;
}

/**
 * Tipagem para os dados brutos retornados pela API (snake_case);
 * inclui as relações trazidas via include.
 */
interface RawRequisition {
  req_id: string;
  req_versao: string;
  req_id_composto?: string;
  req_data?: string;
  req_status?: string;
  req_cond_pagto?: string;
  req_observacao?: string;
  req_tipo?: string;

  // CORREÇÃO: Os campos da API não vêm aninhados num objeto, mas sim com aliases.
  orc_id?: number;
  orc_data?: string;
  orc_status?: string;
  fornecedor_codigo?: string;
  fornecedor_nome?: string;
  fornecedorCompleto?: string; // Campo concatenado
  fornecedor_cpf_cnpj?: string;
  comprador_nome?: string;
  compradorCompleto?: string; // Campo concatenado
  local_entrega?: string;
  destino?: string;
}

interface RawResponse {
  data: RawRequisition[];
  meta: Meta;
}

/**
 * Busca página de requisições de compra com filtros de busca/paginação,
 * e faz o mapeamento dos campos snake_case + relações para o DTO camelCase
 * esperado pelo front.
 */
/**
 * Busca apenas o total de requisições (para paginação)
 */
export async function getRequisicoesCompraCount({
  search = '',
}: {
  search?: string;
}): Promise<number> {
  try {
    const response = await api.get<RawResponse>('/api/requisicoesCompra/get', {
      params: {
        page: 1,
        perPage: 1,
        search,
        countOnly: true
      },
    });
    
    // Se a API tem suporte para countOnly, retorna o total
    if (response.data.meta?.total) {
      return response.data.meta.total;
    }
    
    // Fallback: estimar baseado na primeira página
    return response.data.meta?.total || 0;
  } catch (error) {
    console.error('Erro ao buscar contagem:', error);
    return 0;
  }
}

export async function getRequisicoesCompra({
  page = 1,
  perPage = 25,
  search = '',
}: GetParams): Promise<RequisicoesCompraResponse> {
  const res = await api.get<RawResponse>(`/api/requisicoesCompra/list`, {
    params: { page, limit: perPage, search },
  });

  // Mapeamento ajustado para a resposta simplificada da API
  const mapped: RequisitionDTO[] = res.data.data.map((r: any) => ({
    id: Number(r.id),
    versao: Number(r.versao),

    requisicao: r.requisicao ?? '',
    dataRequisicao: r.dataRequisicao ?? '',
    statusRequisicao: r.statusRequisicao as RequisitionStatus,
    observacao: r.observacao ?? '',
    tipo: r.tipo ?? '',

    fornecedorCodigo: r.fornecedorCodigo ?? '',
    compradorCodigo: r.compradorCodigo ?? '',
    valorTotal: r.valorTotal ?? 0,

    // Campos agora mapeados corretamente da API
    fornecedorNome: r.fornecedorNome ?? '',
    fornecedorCompleto: r.fornecedorCompleto ?? '',
    compradorNome: r.compradorNome ?? '',
    compradorCompleto: r.compradorCompleto ?? '',
    localEntrega: r.localEntrega ?? '',
    destino: r.destino ?? '',
    condPagto: r.condPagto ?? '',
    ordemCompra: r.ordemCompra ?? '',
    dataOrdem: r.dataOrdem ?? '',
    statusOrdem: (r.statusOrdem ?? 'P') as OrderStatus,
    fornecedorCpfCnpj: r.fornecedorCpfCnpj ?? '',
    previsaoChegada: r.previsaoChegada ?? '',
  }));

  return {
    data: mapped,
    meta: res.data.meta || {
      total: 0,
      currentPage: 1,
      lastPage: 1,
      perPage: 25,
    },
  };
}

interface CreatedRequisitionResponse {
  req_id: number;
  req_versao: number;
  req_id_composto: string;
  req_status: string;
}

/**
 * Cria uma nova requisição de compra.
 */
export async function saveRequisition(
  requisition: RequisitionDTO,
): Promise<CreatedRequisitionResponse> {
  const response = await api.post<{ ok: true; data: CreatedRequisitionResponse }>(`/api/requisicoesCompra/post`, requisition);
  return response.data.data;
}

/**
 * Atualiza uma requisição existente.
 */
export async function updateRequisition(
  requisition: RequisitionDTO,
): Promise<void> {
  await api.put(`/api/requisicoesCompra/update`, requisition);
}

/**
 * Interface para parâmetros de busca com filtros estruturados
 */
export interface GetParams2 {
  page?: number;
  perPage?: number;
  filtros?: { campo: string; tipo: string; valor: string }[];
}

/**
 * Busca requisições de compra com filtros estruturados
 * Similar à função buscaClientes do módulo de clientes
 */
export async function buscaRequisicoes({
  page = 1,
  perPage = 25,
  filtros = [],
}: GetParams2): Promise<RequisicoesCompraResponse> {
  try {
    const filtrosCorrigidos = filtros.map((filtro) => ({
      ...filtro,
      valor: String(filtro.valor), // sempre string para consistência
    }));

    const response = await fetch('/api/requisicoesCompra/buscaRequisicoes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page,
        perPage,
        filtros: filtrosCorrigidos,
      }),
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar requisições com filtros');
    }

    const resultado = await response.json();
    
    // Mapear os dados para o formato esperado pelo frontend
    const mappedData: RequisitionDTO[] = resultado.data.map((item: any) => ({
      id: item.id,
      versao: item.versao,
      requisicao: item.requisicao,
      dataRequisicao: item.dataRequisicao,
      statusRequisicao: item.statusRequisicao as RequisitionStatus,
      observacao: item.observacao,
      condPagto: item.condPagto,
      situacao: item.situacao,
      previsaoChegada: item.previsaoChegada,
      fornecedorCodigo: item.fornecedorCodigo,
      fornecedorNome: item.fornecedorNome,
      fornecedorCompleto: item.fornecedorCompleto, // 🔧 CRITICAL FIX: Missing field!
      fornecedorCpfCnpj: item.fornecedorCpfCnpj,
      compradorCodigo: item.compradorCodigo,
      compradorNome: item.compradorNome,
      compradorCompleto: item.compradorCompleto, // 🔧 CRITICAL FIX: Missing field!
      ordemCompra: item.ordemCompra,
      valorTotal: item.valorTotal,
    }));

    return {
      data: mappedData,
      meta: resultado.meta,
    };
  } catch (error) {
    console.error('Erro em buscaRequisicoes:', error);
    throw error;
  }
}

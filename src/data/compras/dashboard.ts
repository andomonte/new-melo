// src/data/compras/dashboard.ts
import api from '@/components/services/api';

// ============================================================================
// TIPAGENS
// ============================================================================
export type DateRange =
  | 'hoje'
  | 'ultima_semana'
  | 'ultimos_30_dias'
  | 'ultimo_trimestre'
  | 'ultimo_ano'
  | 'todo_periodo';

export type ComprasPorPeriodo = {
  comprasDiarias: number;
  comprasSemanais: number;
  comprasMensais: number;
  comprasAnuais: number;
};

export type TopFornecedor = {
  codCredor: string;
  nomeFornecedor: string;
  totalCompras: number;
  totalOrdens: number;
};

export type TopProdutoComprado = {
  codprod: string;
  nomeProduto: string;
  quantidadeComprada: number;
  valorTotal: number;
};

export type StatusRequisicao = {
  status: string;
  statusLabel: string;
  quantidade: number;
  percentual: number;
};

export type ComprasMensais = {
  label: string;
  totalCompras: number;
  totalComprasAnterior?: number;
};

interface ServiceParams {
  range: DateRange;
}

// ============================================================================
// FUNÇÕES DE SERVIÇO
// ============================================================================

async function getComprasPorPeriodo(): Promise<ComprasPorPeriodo> {
  const response = await api.get<ComprasPorPeriodo>(
    '/api/compras/dashboard/compras-periodo',
  );
  return response.data;
}

async function getComprasMensais({
  range,
}: ServiceParams): Promise<ComprasMensais[]> {
  const response = await api.get<ComprasMensais[]>(
    '/api/compras/dashboard/compras-mensais',
    {
      params: { range },
    },
  );
  return response.data;
}

async function getTopFornecedores({
  range,
}: ServiceParams): Promise<TopFornecedor[]> {
  const response = await api.get<TopFornecedor[]>(
    '/api/compras/dashboard/top-fornecedores',
    {
      params: { range },
    },
  );
  return response.data;
}

async function getStatusRequisicoes({
  range,
}: ServiceParams): Promise<StatusRequisicao[]> {
  const response = await api.get<StatusRequisicao[]>(
    '/api/compras/dashboard/status-requisicoes',
    {
      params: { range },
    },
  );
  return response.data;
}

async function getTopProdutos({
  range,
}: ServiceParams): Promise<TopProdutoComprado[]> {
  const response = await api.get<TopProdutoComprado[]>(
    '/api/compras/dashboard/top-produtos',
    {
      params: { range },
    },
  );
  return response.data;
}

// ============================================================================
// EXPORTAÇÃO DO SERVIÇO
// ============================================================================

export const comprasDashboardService = {
  getComprasPorPeriodo,
  getComprasMensais,
  getTopFornecedores,
  getStatusRequisicoes,
  getTopProdutos,
};

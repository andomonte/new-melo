// src/data/vendas/dashboard.ts
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

export type KpiData = {
  totalSales: number;
  newClients: number;
};
export type TopProductsSortBy = 'valor' | 'quantidade';

interface TopProductsParams {
  range: DateRange;
  sortBy: TopProductsSortBy;
}

export type ComissaoData = {
  totalComissao: number;
};
export type Meta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
};

export type TopSellingProduct = {
  codprod: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
};

export type RecentSale = {
  codvenda: string;
  clientName: string;
  date: string;
  total: number;
  status: 'Faturada' | 'Finalizada' | 'Cancelada';
};

export type SalesOverviewDataPoint = { label: string; revenue: number };

// ADICIONADO: Tipagem para os dados do gráfico de vendas mensais.
export type VendasMensais = {
  label: string; // ALTERADO DE 'mes' PARA 'label'
  totalVendas: number;
  totalVendasAnterior?: number;
};

export type VendasPorPeriodo = {
  vendasDiarias: number;
  vendasSemanais: number;
  vendasMensais: number;
  vendasAnuais: number;
};

// ADICIONADO: Tipagem para os melhores clientes
export type TopCliente = {
  codcli: string;
  nomeCliente: string;
  totalVendas: number;
  totalPedidos: number;
};

interface ServiceParams {
  range: DateRange;
}

// ============================================================================
// FUNÇÕES DE SERVIÇO
// ============================================================================

async function getKpiData({ range }: ServiceParams): Promise<KpiData> {
  const response = await api.get<KpiData>(`/api/vendas/dashboard/kpis`, {
    params: { range },
  });
  return response.data;
}

async function getComissaoDoMes(): Promise<ComissaoData> {
  const response = await api.get<ComissaoData>(
    '/api/vendas/dashboard/comissao-mes',
  );
  return response.data;
}

async function getTopProducts({
  range,
  sortBy,
}: TopProductsParams): Promise<TopSellingProduct[]> {
  const response = await api.get<TopSellingProduct[]>(
    `/api/vendas/dashboard/top-products`,
    {
      params: { range, sortBy },
    },
  );
  return response.data;
}

async function getTopProductsForChart({
  range,
}: ServiceParams): Promise<TopSellingProduct[]> {
  const response = await api.get<TopSellingProduct[]>(
    `/api/vendas/dashboard/top-products-chart`,
    {
      params: { range },
    },
  );
  return response.data;
}

async function getRecentSales(
  page: number,
  perPage: number,
): Promise<{ data: RecentSale[]; meta: Meta }> {
  const response = await api.get(`/api/vendas/dashboard/recent-sales`, {
    params: { page, perPage },
  });
  return response.data;
}
async function getSalesOverview({
  range,
}: ServiceParams): Promise<SalesOverviewDataPoint[]> {
  const response = await api.get<SalesOverviewDataPoint[]>(
    `/api/vendas/dashboard/sales-overview`,
    { params: { range } },
  );
  return response.data;
}

// ADICIONADO: Nova função para buscar os dados do gráfico de vendas mensais.
// Esta função chamará o endpoint que criamos anteriormente.
async function getVendasMensais({
  range,
}: ServiceParams): Promise<VendasMensais[]> {
  const response = await api.get<VendasMensais[]>(
    '/api/vendas/dashboard/vendas-mensais',
    {
      params: { range },
    },
  );
  return response.data;
}

// ADICIONADO: Nova função para buscar vendas por período (dia, semana, mês, ano)
async function getVendasPorPeriodo(): Promise<VendasPorPeriodo> {
  const response = await api.get<VendasPorPeriodo>(
    '/api/vendas/dashboard/vendas-periodo',
  );
  return response.data;
}

// ADICIONADO: Nova função para buscar os melhores clientes
async function getTopClientes(): Promise<TopCliente[]> {
  const response = await api.get<TopCliente[]>(
    '/api/vendas/dashboard/top-clientes',
  );
  return response.data;
}

// ============================================================================
// EXPORTAÇÃO DO SERVIÇO
// ============================================================================

export const dashboardService = {
  getKpiData,
  getTopProducts,
  getTopProductsForChart,
  getRecentSales,
  getSalesOverview,
  getComissaoDoMes,
  getVendasMensais, // Adicionado!
  getVendasPorPeriodo, // Adicionado!
  getTopClientes, // Adicionado!
};

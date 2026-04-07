// src/data/pedidos/monitorTVService.ts
import api from '@/components/services/api';

export interface PedidoTV {
  NrVenda: string;
  Cliente: string;
  horario: string;
  status: string;
  responsavel: string;
  previsao: number;
  inicioseparacao: string | null;
  statusPedido: string;
  // Campo update será mapeado do horario para facilitar ordenação
  update: string;
}

export interface MonitorTVResponse {
  data: PedidoTV[];
  meta: {
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
    from: number;
    to: number;
  };
}

export interface MonitorTVParams {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: 'codvenda' | 'cliente' | 'dtupdate';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Busca pedidos para o Monitor de TV com ordenação correta
 * Por padrão, ordena por dtupdate DESC (mais recente primeiro)
 */
export async function getPedidosParaMonitorTV(
  params: MonitorTVParams = {},
): Promise<MonitorTVResponse> {
  const {
    page = 1,
    perPage = 999, // Monitor geralmente mostra todos
    search = '',
    sortBy = 'dtupdate', // Por padrão ordena por update
    sortOrder = 'DESC', // Mais recente primeiro
  } = params;

  try {
    const response = await api.get('/api/pedidos/tv', {
      params: {
        page,
        perPage,
        search,
        sortBy,
        sortOrder,
      },
    });

    // Mapear os dados para incluir o campo 'update'
    const pedidosComUpdate: PedidoTV[] = response.data.data.map(
      (pedido: any) => ({
        ...pedido,
        update: pedido.horario, // Mapear horario para update para compatibilidade
      }),
    );

    return {
      data: pedidosComUpdate,
      meta: response.data.meta,
    };
  } catch (error) {
    console.error('Erro ao buscar pedidos para Monitor TV:', error);
    return {
      data: [],
      meta: {
        total: 0,
        currentPage: 1,
        lastPage: 1,
        perPage: perPage,
        from: 0,
        to: 0,
      },
    };
  }
}

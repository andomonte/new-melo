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
}

export interface PedidoRecebimento {
  NrVenda: string;
  Cliente: string;
  Vendedor: string;
  horario: string;
  status: string;
}

// Interface para resposta da API compatível com GenericCrudPage
export interface PaginationMeta {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
}

export interface ListApiResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

// Funções adaptadas para o formato esperado pelo GenericCrudPage
export async function getPedidosParaTVPaginado(params: {
  page: number;
  perPage: number;
  search: string;
  filtros: Filtro[];
}): Promise<ListApiResponse<PedidoTV>> {
  try {
    const response = await api.get('/api/pedidos/tv', {
      params: {
        page: params.page,
        perPage: params.perPage,
        search: params.search,
        sortBy: 'dtupdate',
        sortOrder: 'DESC',
      },
    });

    return {
      data: response.data.data || [],
      meta: response.data.meta || {
        total: 0,
        perPage: params.perPage,
        currentPage: params.page,
        lastPage: 1,
        firstPage: 1,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar pedidos para TV:', error);
    throw new Error('Falha ao carregar pedidos para TV');
  }
}

export async function getPedidosParaRecebimentoPaginado(params: {
  page: number;
  perPage: number;
  search: string;
  filtros: Filtro[];
}): Promise<ListApiResponse<PedidoRecebimento>> {
  try {
    const response = await api.get('/api/pedidos/recebimento', {
      params: {
        page: params.page,
        perPage: params.perPage,
        search: params.search,
      },
    });

    return {
      data: response.data.data || [],
      meta: response.data.meta || {
        total: 0,
        perPage: params.perPage,
        currentPage: params.page,
        lastPage: 1,
        firstPage: 1,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar pedidos para recebimento:', error);
    throw new Error('Falha ao carregar pedidos para recebimento');
  }
}

/**
 * Salva o motivo da impressão de um pedido
 */
export async function salvarMotivoImpressao(dados: {
  codvenda: string;
  motivo: string;
}): Promise<void> {
  try {
    await api.post('/api/recebimento/imprimir', dados);
  } catch (error) {
    console.error('Erro ao salvar motivo da impressão:', error);
    throw new Error('Falha ao salvar motivo da impressão');
  }
}

// Funções de compatibilidade (mantidas para não quebrar código existente)
export async function getPedidosParaTV(): Promise<PedidoTV[]> {
  const result = await getPedidosParaTVPaginado({
    page: 1,
    perPage: 100,
    search: '',
    filtros: [],
  });
  return result.data;
}

export async function getPedidosParaRecebimento(): Promise<
  PedidoRecebimento[]
> {
  const result = await getPedidosParaRecebimentoPaginado({
    page: 1,
    perPage: 100,
    search: '',
    filtros: [],
  });
  return result.data;
}

// Interface para contagens de pedidos
export interface ContagensPedidos {
  aguardando: number;
  emSeparacao: number;
  separados: number;
  emConferencia: number;
  total: number;
}

/**
 * Busca as contagens de pedidos por status
 */
export async function getContagensPedidos(): Promise<ContagensPedidos> {
  try {
    const response = await api.get('/api/pedidos/tv/contagens');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar contagens de pedidos:', error);
    throw new Error('Falha ao carregar contagens de pedidos');
  }
}

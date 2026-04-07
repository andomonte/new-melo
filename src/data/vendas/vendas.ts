// data/vendas/vendas.ts

import api from '@/components/services/api';

// Tipagem para marca
export interface Marca {
  codmarca: string;
  descr: string | null;
}

// Tipagem para produto
export interface Produto {
  codprod: string;
  descr: string | null;
  ref: string | null;
  origem: string | null;
  qtest?: number; // quantidade em estoque
  prvenda?: number; // preço de venda
  dbmarcas?: Marca | null;
}

// Tipagem para ItemVenda
export interface ItemVenda {
  codvenda: string;
  codprod: string;
  qtd: number; // quantidade na tabela do banco
  prunit: number; // preço unitário na tabela do banco
  desconto?: number; // desconto na tabela do banco
  descr?: string; // descrição do item
  dbprod?: Produto | null; // produto relacionado
}

// Interface alternativa para compatibilidade com código existente
export interface ItemVendaLegacy {
  codvenda: string;
  codprod: string;
  quantidade: number;
  preco: number;
  dbprod?: Produto | null;
}

// Tipagem para ItemVendaSalva
export interface ItemVendaSalva {
  codvenda: string;
  codprod: string;
  qtd: number; // quantidade na tabela do banco
  prunit: number; // preço unitário na tabela do banco
  desconto?: number; // desconto na tabela do banco
  descr?: string; // descrição do item
  dbprod?: Produto | null; // produto relacionado
}

// Tipagem para dados básicos do cliente
export interface ClienteBasico {
  nome: string | null;
  nomefant: string | null;
}

// Tipagem base para venda
export interface VendaBase {
  codvenda: string;
  codcli: string | null;
  data: Date;
  status: string | null;
  total?: number | string; // valor total da venda
  codusr?: string; // código do usuário
  codvend?: string; // código do vendedor
  // outros campos que você precisar
}

// Tipo para Venda com informações adicionais
export interface Venda extends VendaBase {
  tipoOrigem: 'FINALIZADA' | 'SALVA' | 'FATURADA' | 'VENDA' | 'SALVA2';
  dbitvenda: (ItemVenda | ItemVendaSalva)[];
  dbclien: ClienteBasico | null;
}

export interface Vendas {
  data: Venda[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
  };
}

/**
 * Define a estrutura do objeto de parâmetros aceitos pela função `getVendas`.
 */
interface GetVendasParams {
  page: number;
  perPage: number;
  search?: string;
  codvend?: string;
  // NOVO: Parâmetro opcional para filtrar pelo status da venda.
  status?:
    | 'faturada'
    | 'finalizada'
    | 'salva'
    | 'combinadas'
    | 'salva2'
    | 'bloqueada'
    | 'todas';
  // NOVO: Parâmetro opcional para filtrar pelas vendas de um vendedor específico.
  codvendUsuario?: string;
  // NOVO: Parâmetro opcional para filtrar pelas vendas de um usuário específico.
  codusrUsuario?: string;
  // 💡 NOVO: Parâmetros de ordenação
  sortBy?: string;
  sortDir?: 'asc' | 'desc'; // Usando um tipo mais restritivo, se for o caso
  searchField?: string;
}

/**
 * Busca uma lista paginada e filtrada de vendas no backend.
 */
export async function getVendas({
  page,
  perPage,
  search,
  codvend,
  status, // NOVO
  codvendUsuario, // NOVO
  codusrUsuario, // NOVO
  sortBy,
  sortDir,
  searchField,
}: GetVendasParams): Promise<Vendas> {
  let vendas: Vendas = {
    data: [],
    meta: {
      total: 0,
      lastPage: 1,
      currentPage: 1,
      perPage: 10,
    },
  };

  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });

    if (search) {
      params.append('search', search);
    }
    if (searchField) {
      // ✅ 2) ENVIAR PARA O BACKEND
      params.append('searchField', searchField);
    }
    if (codvend) {
      params.append('codvend', codvend);
    }
    // NOVO: Adiciona o parâmetro de status à URL apenas se ele for fornecido.
    if (status) {
      params.append('status', status);
    }
    // NOVO: Adiciona o parâmetro de vendedor à URL apenas se ele for fornecido.
    if (codvendUsuario) {
      params.append('codvend_usuario', codvendUsuario);
    }
    // NOVO: Adiciona o parâmetro de usuário à URL apenas se ele for fornecido.
    if (codusrUsuario) {
      params.append('codusr_usuario', codusrUsuario);
    }
    if (sortBy) {
      params.append('sortBy', sortBy);
    }
    if (sortDir) {
      params.append('sortDir', sortDir);
    }
    const response = await api.get(`/api/vendas/get?${params.toString()}`);

    if (response.data && response.data.meta && response.data.data) {
      const apiMeta = response.data.meta;
      vendas = {
        data: response.data.data,
        meta: {
          total: apiMeta.total,
          lastPage: apiMeta.totalPages,
          currentPage: apiMeta.currentPage,
          perPage: apiMeta.perPage,
        },
      };
    } else {
      console.warn(
        'Estrutura de resposta da API de vendas inesperada:',
        response.data,
      );
    }
  } catch (error) {
    console.error('Erro ao buscar vendas na camada de dados:', error);
    throw error;
  }

  return vendas;
}

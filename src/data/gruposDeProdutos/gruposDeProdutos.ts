// src/data/gruposDeProdutos/gruposDeProdutos.ts

import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams'; // Esta GetParams NÃO TERÁ FILTROS
import api from '@/components/services/api';

// Definindo a interface GrupoProduto (mantida como está)
export interface GrupoProduto {
  codgpp: string; // @id @db.VarChar(5) - Chave Primária
  descr: string; // @unique @db.VarChar(30)
  codvend?: string | null; // @db.VarChar(5)
  descbalcao?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrev30?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrev45?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrev60?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrv30?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrv45?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscrv60?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscbv30?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscbv45?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscbv60?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscpv30?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscpv45?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  dscpv60?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  comgpp?: number | null; // Decimal? @db.Decimal(3, 2)
  comgpptmk?: number | null; // Decimal? @db.Decimal(3, 2)
  comgppextmk?: number | null; // Decimal? @db.Decimal(3, 2)
  codseg?: string | null; // @db.VarChar(5)
  diasreposicao?: number | null; // Int? @default(40)
  codcomprador?: string | null; // @default("000") @db.VarChar(3)
  ramonegocio?: string | null; // @default("S") @db.VarChar(1)
  gpp_id?: number | null; // Decimal? @db.Decimal
  p_comercial?: number | null; // Int? @default(0)
  v_marketing?: number | null; // Decimal? @default(0) @db.Decimal(5, 2)
  codgpc?: string | null; // @default("0000") @db.VarChar(4)
  margem_min_venda?: number | null; // Decimal? @default(10.00) @db.Decimal(7, 2)
  margem_med_venda?: number | null; // Decimal? @default(10.00) @db.Decimal(7, 2)
  margem_ide_venda?: number | null; // Decimal? @default(10.00) @db.Decimal(7, 2)
  bloquear_preco?: string | null; // @default("S") @db.VarChar(1)
  codgrupai?: number | null; // Decimal? @db.Decimal
  codgrupoprod?: number | null; // Decimal? @db.Decimal
  DSCBALCAO?: number | null; // Decimal? @db.Decimal(5, 2)
}

export interface GruposDeProdutosResponse {
  data: GrupoProduto[];
  meta: Meta;
}

export interface TodosGruposDeProdutosResponse {
  data: GrupoProduto[];
}

// 📌 FUNÇÃO EXISTENTE: getGruposDeProdutos - MANTIDA INALTERADA, USA GetParams (sem filtros)
export async function getGruposDeProdutos({
  page,
  perPage,
  search,
}: GetParams): Promise<GruposDeProdutosResponse> {
  let gruposDeProdutos: GruposDeProdutosResponse =
    {} as GruposDeProdutosResponse;

  await api
    .get(
      `/api/gruposProduto/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      gruposDeProdutos = response.data;
    });

  return gruposDeProdutos;
}

// 🆕 NOVAS INTERFACES E FUNÇÃO PARA BUSCA COM FILTROS (SIMILAR AO CLIENTES)
export type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

export type Filtros = Filtro[];

export type GetParamsGruposDeProdutosComFiltro = {
  page?: number;
  perPage?: number;
  search?: string; // Incluído para compatibilidade e flexibilidade
  filtros?: Filtro[];
};

export async function buscaGruposDeProdutos({
  page = 1,
  perPage = 10,
  search = '', // Adicionado para poder enviar busca também no body
  filtros = [],
}: GetParamsGruposDeProdutosComFiltro): Promise<GruposDeProdutosResponse> {
  // Retorna GruposDeProdutosResponse
  try {
    const filtrosCorrigidos = filtros.map((filtro) => ({
      ...filtro,
      valor: String(filtro.valor), // Garante que o valor é string
    }));

    // Usando POST para enviar os filtros no body, similar ao 'buscaClientes'
    const response = await api.post(`/api/gruposProduto/get`, {
      // Endpoint /get pode ser o mesmo, mas agora aceita POST
      page,
      perPage,
      search,
      filtros: filtrosCorrigidos,
    });

    return response.data; // Retorna os dados diretamente
  } catch (error) {
    console.error('Erro em buscaGruposDeProdutos:', error);
    throw error;
  }
}

// As outras funções (insert, get único, update, delete, get todos) permanecem INALTERADAS
export async function insertGrupoProduto(
  grupoProduto: Omit<GrupoProduto, 'codgpp'>,
): Promise<void> {
  try {
    await api.post('/api/gruposProduto/add', grupoProduto);
  } catch (error: any) {
    // Extrai mensagem de erro detalhada da API
    if (error.response?.data) {
      const apiError = error.response.data;

      // Lança erro com mensagem da API e informações adicionais
      const enhancedError = new Error(
        apiError.error || 'Erro ao cadastrar grupo de produto',
      );
      (enhancedError as any).field = apiError.field;
      (enhancedError as any).statusCode = error.response.status;
      (enhancedError as any).existingRecord = apiError.existingRecord;

      throw enhancedError;
    }

    // Se não houver resposta da API, lança o erro original
    throw error;
  }
}

export async function getGrupoProduto(codgpp: string): Promise<GrupoProduto> {
  let grupoProduto: GrupoProduto = {} as GrupoProduto;
  await api.get(`/api/gruposProduto/get/${codgpp}`).then((response) => {
    grupoProduto = response.data.data;
  });
  return grupoProduto;
}

export async function updateGrupoProduto(
  grupoProduto: GrupoProduto,
): Promise<void> {
  const { codgpp, ...updateData } = grupoProduto;
  if (typeof codgpp === 'undefined' || codgpp === null || codgpp === '') {
    throw new Error(
      'Código do Grupo de Produto (codgpp) é obrigatório para atualização.',
    );
  }

  try {
    await api.put(`/api/gruposProduto/update?codgpp=${codgpp}`, updateData);
  } catch (error: any) {
    // Extrai mensagem de erro detalhada da API
    if (error.response?.data) {
      const apiError = error.response.data;

      // Lança erro com mensagem da API e informações adicionais
      const enhancedError = new Error(
        apiError.error || 'Erro ao atualizar grupo de produto',
      );
      (enhancedError as any).field = apiError.field;
      (enhancedError as any).statusCode = error.response.status;
      (enhancedError as any).existingRecord = apiError.existingRecord;

      throw enhancedError;
    }

    // Se não houver resposta da API, lança o erro original
    throw error;
  }
}

export async function deletarGrupoProduto(codgpp: string): Promise<void> {
  try {
    await api.delete(`/api/gruposProduto/delete/${codgpp}`);
  } catch (error: any) {
    console.error(
      'Erro ao deletar grupo de produto na camada de dados:',
      error,
    );
    throw error;
  }
}

export async function getTodosGruposDeProdutos(): Promise<TodosGruposDeProdutosResponse> {
  let todosGruposDeProdutos: TodosGruposDeProdutosResponse = { data: [] };
  await api.get(`/api/gruposProduto/get/todos`).then((response) => {
    todosGruposDeProdutos = response.data;
  });
  return todosGruposDeProdutos;
}

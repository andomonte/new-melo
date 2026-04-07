import api from '@/components/services/api';
import { PaginationMeta } from '@/components/common/genericCrudPage/index';

// --- INTERFACES ---

/**
 * Define os parâmetros para a busca paginada.
 * (Pode ser movido para um arquivo comum se usado em outros serviços)
 */
export interface GetParams {
  page?: number;
  perPage?: number;
  search?: string;
  filtros?: any[]; // Incluído para compatibilidade com o componente genérico
}

/**
 * Define a estrutura de um objeto de Formação de Preço de Venda.
 * Os campos de Decimal do Prisma serão tratados como 'number' no frontend.
 */
export interface FormacaoPrecoVenda {
  CODPROD: string;
  TIPOPRECO: number;
  MARGEMLIQUIDA: number;
  ICMSDEVOL: number;
  ICMS: number;
  IPI: number;
  PIS: number;
  COFINS: number;
  DCI: number;
  COMISSAO: number;
  FATORDESPESAS: number;
  PRECOVENDA: number;
  TAXACARTAO: number | null; // Pode ser nulo
}

/**
 * Define a estrutura da resposta da API para uma lista de formações de preço.
 */
export interface FormacoesPrecoVenda {
  data: FormacaoPrecoVenda[];
  meta: PaginationMeta;
}

// --- FUNÇÕES DE SERVIÇO ---

/**
 * Busca uma lista paginada de formações de preço.
 */
export async function getFormacoesPrecoVenda({
  page,
  perPage,
  search,
  filtros, // Adicionado para futuras implementações de filtro no backend
}: GetParams): Promise<FormacoesPrecoVenda> {
  // Se tem filtros, usar POST; senão usar GET com search
  if (filtros && filtros.length > 0) {
    const response = await api.post<FormacoesPrecoVenda>(
      '/api/formacao-preco',
      {
        page,
        perPage,
        filtros,
      },
    );
    return response.data;
  } else {
    const response = await api.get<FormacoesPrecoVenda>('/api/formacao-preco', {
      params: { page, perPage, search },
    });
    return response.data;
  }
}

/**
 * Busca uma única formação de preço pelo seu CODPROD.
 */
export async function getFormacaoPrecoVenda(
  codprod: string,
): Promise<FormacaoPrecoVenda> {
  const response = await api.get<FormacaoPrecoVenda>(
    `/api/formacao-preco/${codprod}`,
  );
  return response.data;
}

/**
 * Cria uma nova formação de preço.
 */
export async function createFormacaoPrecoVenda(
  data: FormacaoPrecoVenda,
): Promise<FormacaoPrecoVenda> {
  const response = await api.post<FormacaoPrecoVenda>(
    '/api/formacao-preco',
    data,
  );
  return response.data;
}

/**
 * Atualiza uma formação de preço existente.
 * O 'data' pode ser um objeto parcial com os campos a serem atualizados.
 */
export async function updateFormacaoPrecoVenda(
  codprod: string,
  data: Partial<FormacaoPrecoVenda>,
): Promise<FormacaoPrecoVenda> {
  const response = await api.put<FormacaoPrecoVenda>(
    `/api/formacao-preco/${codprod}`,
    data,
  );
  return response.data;
}

/**
 * Deleta uma formação de preço pelo seu CODPROD.
 */
export async function deleteFormacaoPrecoVenda(codprod: string): Promise<void> {
  await api.delete(`/api/formacao-preco/${codprod}`);
}

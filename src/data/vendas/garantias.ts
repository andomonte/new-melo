// src/data/vendas/garantias.ts
// Acesso da tela Garantias de Produtos (porte do TFrmGarantiaProd do Delphi).

import api from '@/components/services/api';
import { PaginationMeta } from '@/components/common/genericCrudPage';

/** Situações do combo do Delphi (CbStatusAlt). */
export const STATUS_GARANTIA: Record<string, string> = {
  P: 'PROVISÓRIO',
  A: 'ATENDIDO',
  N: 'NÃO ATENDIDO',
  M: 'MELO',
  C: 'COBRADO DO CLIENTE',
};

/** Na inclusão o Delphi só oferece PROVISÓRIO e MELO. */
export const STATUS_INCLUSAO = [
  { value: 'P', label: STATUS_GARANTIA.P },
  { value: 'M', label: STATUS_GARANTIA.M },
];

export interface ItemGarantia {
  codprod: string;
  ref?: string;
  descr?: string;
  marca?: string;
  qtde: number;
  prunit: number;
  total?: number;
  arm_id: number;
  armazem?: string;
}

export interface Garantia {
  codgar: string;
  nrodoc: string;
  codcli: string;
  cliente?: string;
  dt_gar: string;
  status: string;
  obs?: string | null;
  cancel: string;
  itens?: number | ItemGarantia[];
  total_garantia?: number | string;
}

export interface FiltrosGarantia {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  de?: string;
  ate?: string;
  incluirCanceladas?: boolean;
}

export async function listarGarantias(
  filtros: FiltrosGarantia,
): Promise<{ data: Garantia[]; meta: PaginationMeta }> {
  const { data } = await api.post('/api/vendas/garantias', {
    page: 1,
    perPage: 10,
    search: '',
    ...filtros,
  });
  return data;
}

export async function obterGarantia(
  codgar: string,
): Promise<Garantia & { itens: ItemGarantia[] }> {
  const { data } = await api.get(
    `/api/vendas/garantias/${encodeURIComponent(codgar)}`,
  );
  return data;
}

export async function criarGarantia(payload: {
  nrodoc: string;
  codcli: string;
  obs?: string;
  status: string;
  dt_gar?: string;
  codusr?: string;
  itens: { codprod: string; qtde: number; prunit: number; arm_id: number }[];
}): Promise<{ codgar: string; message: string }> {
  const { data } = await api.post('/api/vendas/garantias', payload);
  return data;
}

export async function alterarSituacaoGarantia(
  codgar: string,
  status: string,
  codusr?: string,
): Promise<void> {
  await api.put(`/api/vendas/garantias/${encodeURIComponent(codgar)}`, {
    status,
    codusr,
  });
}

/** Cancela e DEVOLVE o estoque dos itens (Canc_Gar do Oracle). */
export async function cancelarGarantia(
  codgar: string,
  codusr?: string,
): Promise<void> {
  // axios manda corpo no DELETE via { data }.
  await api.delete(`/api/vendas/garantias/${encodeURIComponent(codgar)}`, {
    data: { codusr },
  });
}

// --- Lookups reaproveitados de endpoints existentes -------------------------

export async function buscarClientes(
  search: string,
): Promise<{ codcli: string; nome: string }[]> {
  const { data } = await api.get('/api/clientes/get', {
    params: { search, page: 1, perPage: 20 },
  });
  return data?.data ?? [];
}

export async function buscarArmazens(): Promise<
  { arm_id: number; arm_descricao: string }[]
> {
  const { data } = await api.get('/api/armazens/listar');
  return data?.armazens ?? [];
}

export interface EstoqueArmazem {
  armId: number;
  armDescricao: string;
  qtestDisponivel: number;
  bloqueado: boolean;
}

/**
 * Estoque disponível do produto por armazém (arp_qtest - arp_qtest_reservada),
 * a mesma conta do QTEST_DISPONIVEL que o Delphi usa para barrar a quantidade.
 */
export async function estoqueDoProduto(
  codprod: string,
): Promise<EstoqueArmazem[]> {
  const { data } = await api.get('/api/armazem/estoque-produto', {
    params: { codprods: codprod },
  });
  const produto = (data?.data ?? []).find(
    (p: any) => String(p.codprod) === String(codprod),
  );
  return produto?.armazens ?? [];
}

// src/components/corpo/comprador/RequisicoesCompra/services/requisitionService.ts
import type { RequisitionDTO } from '../types/requisition';

export async function getAllRequisitions(params: {
  filter: string;
}): Promise<RequisitionDTO[]> {
  const query = params.filter
    ? `?filter=${encodeURIComponent(params.filter)}`
    : '';
  const res = await fetch(`/api/requisicoesCompra${query}`);
  if (!res.ok) throw new Error('Falha ao carregar requisições');
  return (await res.json()) as RequisitionDTO[];
}

import api from '@/components/services/api';
import type { RequisitionItem, ItemFormData } from '../types';

export interface ItemsResponse {
  data: RequisitionItem[];
  meta?: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
  };
}

/**
 * Get all items for a specific requisition
 */
export async function getRequisitionItems(
  reqId: number,
  reqVersion: number
): Promise<ItemsResponse> {
  const response = await api.get<ItemsResponse>('/api/requisicoesCompra/items', {
    params: { req_id: reqId, req_versao: reqVersion },
  });
  return response.data;
}

/**
 * Create a new requisition item
 */
export async function createRequisitionItem(
  reqId: number,
  reqVersion: number,
  itemSeq: number,
  itemData: ItemFormData
): Promise<RequisitionItem> {
  const payload = {
    req_id: reqId,
    req_versao: reqVersion,
    item_seq: itemSeq,
    ...itemData,
  };

  const response = await api.post<ItemsResponse>('/api/requisicoesCompra/items', payload);
  return response.data.data[0];
}

/**
 * Update an existing requisition item
 */
export async function updateRequisitionItem(
  itemId: number,
  updates: Partial<{
    quantidade: number;
    preco_unitario: number;
    observacao: string;
    status: string;
  }>
): Promise<RequisitionItem> {
  const response = await api.put<ItemsResponse>('/api/requisicoesCompra/items', {
    id: itemId,
    ...updates,
  });
  return response.data.data[0];
}

/**
 * Delete a requisition item
 */
export async function deleteRequisitionItem(itemId: number): Promise<void> {
  await api.delete(`/api/requisicoesCompra/items?id=${itemId}`);
}

/**
 * Batch create multiple items - usa API batch para criar UMA entrada no histórico
 */
export async function createMultipleItems(
  reqId: number,
  reqVersion: number,
  items: (ItemFormData & { item_seq: number })[],
  userId?: string,
  userName?: string
): Promise<RequisitionItem[]> {
  // Usar API batch para criar todos os itens com uma única entrada no histórico
  const response = await api.post<{
    success: boolean;
    data: RequisitionItem[];
    message: string;
  }>('/api/requisicoesCompra/items/batch', {
    req_id: reqId,
    req_versao: reqVersion,
    userId,
    userName,
    items: items.map(item => ({
      codprod: item.codprod,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      observacao: item.observacao || ''
    }))
  });

  return response.data.data || [];
}

/**
 * Calculate next item sequence number
 */
export async function getNextItemSequence(
  reqId: number,
  reqVersion: number
): Promise<number> {
  const { data: items } = await getRequisitionItems(reqId, reqVersion);
  
  if (items.length === 0) {
    return 1;
  }
  
  const maxSeq = Math.max(...items.map(item => item.item_seq));
  return maxSeq + 1;
}
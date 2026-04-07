import api from '@/components/services/api';
import { VendaDetalhes } from '@/pages/api/vendas/detalhes/[codvenda]';

export async function getVendaDetalhes(
  codvenda: string,
): Promise<VendaDetalhes> {
  try {
    const response = await api.get(`/api/vendas/detalhes/${codvenda}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    throw new Error('Não foi possível carregar os detalhes da venda');
  }
}

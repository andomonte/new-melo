import api from '@/components/services/api';
import { Cliente } from '@/data/clientes/clientes';

export interface Limite {
  codclilim: number;
  codcli?: string;
  ultimo_limite?: number;
  data?: Date;
  observacao?: string;
  codusr?: string;
}

export async function getUltimoLimiteCliente(codcli: string): Promise<Limite> {
  try {
    const response = await api.get(`/api/clientes/limites/${codcli}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar limite do cliente:', error);
    throw error;
  }
}

export async function insertLimiteCliente(
  cliente: Cliente,
  observacao: string,
  codusr: string,
): Promise<Limite> {
  try {
    const body = {
      cliente,
      observacao,
      codusr,
    };

    // ADICIONE ESTA LINHA PARA DEPURAÇÃO

    const response = await api.post('/api/clientes/limites/add', body);
    return response.data;
  } catch (error) {
    console.error('Erro ao inserir limite do cliente:', error);
    throw error;
  }
}

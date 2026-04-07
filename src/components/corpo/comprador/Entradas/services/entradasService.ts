import api from '@/components/services/api';
import {
  EntradaDTO,
  NovaEntradaData,
  EditEntradaData,
  EntradasFilters,
  EntradasMeta,
} from '../types';

export interface EntradasListResponse {
  data: EntradaDTO[];
  meta: EntradasMeta;
}

export interface EntradasAdvancedFilters {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  tipoEntrada?: string;
  dataInicio?: string;
  dataFim?: string;
  fornecedor?: string;
}

export const entradasService = {
  async getEntradas(params: {
    page?: number;
    perPage?: number;
    search?: string;
    filters?: EntradasFilters;
  }): Promise<EntradasListResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append('page', params.page.toString());
      if (params.perPage) queryParams.append('perPage', params.perPage.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.filters?.status) queryParams.append('status', params.filters.status);
      if (params.filters?.tipoEntrada) queryParams.append('tipoEntrada', params.filters.tipoEntrada);
      if (params.filters?.dataInicio) queryParams.append('dataInicio', params.filters.dataInicio);
      if (params.filters?.dataFim) queryParams.append('dataFim', params.filters.dataFim);
      // Filtros dinamicos por coluna (enviados como JSON)
      if (params.filters?.filtrosColuna && params.filters.filtrosColuna.length > 0) {
        queryParams.append('filtros', JSON.stringify(params.filters.filtrosColuna));
      }

      const response = await api.get(`/api/entradas?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
      throw error;
    }
  },

  async getEntradasAdvanced(params: EntradasAdvancedFilters): Promise<EntradasListResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append('page', params.page.toString());
      if (params.perPage) queryParams.append('perPage', params.perPage.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);
      if (params.tipoEntrada) queryParams.append('tipoEntrada', params.tipoEntrada);
      if (params.dataInicio) queryParams.append('dataInicio', params.dataInicio);
      if (params.dataFim) queryParams.append('dataFim', params.dataFim);
      if (params.fornecedor) queryParams.append('fornecedor', params.fornecedor);

      const response = await api.get(`/api/entradas?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
      throw error;
    }
  },

  async exportar(params: EntradasAdvancedFilters): Promise<Blob> {
    try {
      const response = await api.post('/api/entradas/exportar', params, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao exportar entradas:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<EntradaDTO> {
    try {
      const response = await api.get(`/api/entradas/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar entrada:', error);
      throw error;
    }
  },

  async create(data: NovaEntradaData): Promise<EntradaDTO> {
    try {
      const response = await api.post('/api/entradas', data);
      return response.data;
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      throw error;
    }
  },

  async update(id: string, data: EditEntradaData): Promise<EntradaDTO> {
    try {
      const response = await api.put(`/api/entradas/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/api/entradas/${id}`);
    } catch (error) {
      console.error('Erro ao excluir entrada:', error);
      throw error;
    }
  },
};
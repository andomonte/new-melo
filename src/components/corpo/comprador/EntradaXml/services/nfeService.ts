import api from '@/components/services/api';
import { 
  NFeDTO, 
  ProcessNFeData, 
  UploadXmlData,
  NFesMeta
} from '../types';

export interface NFeListResponse {
  data: NFeDTO[];
  meta: NFesMeta;
}

export const nfeService = {
  async getNFes(params: {
    page?: number;
    perPage?: number;
    search?: string;
    filters?: Record<string, any>;
  }): Promise<NFeListResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append('page', params.page.toString());
      if (params.perPage) queryParams.append('perPage', params.perPage.toString());
      if (params.search) queryParams.append('search', params.search);

      // Filtros avançados
      if (params.filters) {
        const { status, fornecedor, numeroNfe, serieNfe, chaveNfe, dataInicio, dataFim, valorMinimo, valorMaximo, temAssociacao } = params.filters;

        // Status pode ser array, enviar separado por vírgula
        if (status && Array.isArray(status) && status.length > 0) {
          queryParams.append('status', status.join(','));
        } else if (status && typeof status === 'string') {
          queryParams.append('status', status);
        }

        if (fornecedor) queryParams.append('fornecedor', fornecedor);
        if (numeroNfe) queryParams.append('numeroNfe', numeroNfe);
        if (serieNfe) queryParams.append('serieNfe', serieNfe);
        if (chaveNfe) queryParams.append('chaveNfe', chaveNfe);
        if (dataInicio) queryParams.append('dataInicio', dataInicio);
        if (dataFim) queryParams.append('dataFim', dataFim);
        if (valorMinimo) queryParams.append('valorMinimo', valorMinimo);
        if (valorMaximo) queryParams.append('valorMaximo', valorMaximo);
        if (temAssociacao) queryParams.append('temAssociacao', temAssociacao);
      }

      const response = await api.get(`/api/nfe?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar NFes:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<NFeDTO> {
    try {
      const response = await api.get(`/api/nfe/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar NFe:', error);
      throw error;
    }
  },

  async processNFe(id: string, data: ProcessNFeData): Promise<any> {
    try {
      const response = await api.post(`/api/nfe/${id}/process`, data);
      return response.data;
    } catch (error) {
      console.error('Erro ao processar NFe:', error);
      throw error;
    }
  },

  async uploadXml(data: UploadXmlData): Promise<any> {
    try {
      const formData = new FormData();
      data.files.forEach(file => {
        formData.append('xmlFiles', file);
      });

      const response = await api.post('/api/nfe/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao fazer upload de XML:', error);
      throw error;
    }
  },

  async deleteNFe(id: string): Promise<void> {
    try {
      await api.delete(`/api/nfe/${id}`);
    } catch (error) {
      console.error('Erro ao excluir NFe:', error);
      throw error;
    }
  },
};
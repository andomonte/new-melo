// src/data/inscricoesEstaduais/inscricoesEstaduais.ts

import api from '@/components/services/api';
import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';

// --- Interfaces para Inscrição Estadual ---
export interface InscricaoEstadual {
  cgc: string;
  inscricaoestadual: string;
  nomecontribuinte: string;
}

export interface InscricaoEstadualListResponse {
  data: InscricaoEstadual[];
  meta: Meta;
}

// Função para buscar inscrições estaduais de db_ie
export async function getInscricoesEstaduais({
  page,
  perPage,
  search,
  cgc,
}: GetParams & { cgc?: string }): Promise<InscricaoEstadualListResponse> {
  let inscricoesEstaduais: InscricaoEstadualListResponse = {
    data: [],
    meta: {} as Meta,
  };

  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      search: search || '',
    });

    if (cgc) {
      params.append('cgc', cgc);
    }

    const response = await api.get(
      `/api/inscricoesEstaduais/get?${params.toString()}`,
    );
    inscricoesEstaduais = response.data;
  } catch (error: any) {
    console.error('Erro ao buscar inscrições estaduais:', error);
    throw error;
  }

  return inscricoesEstaduais;
}

// Função para buscar TODAS as inscrições estaduais de um CGC específico
export async function getInscricoesEstaduaisByCgc(
  cgc: string,
): Promise<InscricaoEstadual[]> {
  try {
    const response = await api.get(`/api/inscricoesEstaduais/get?cgc=${cgc}&perPage=1000`);
    return response.data.data || [];
  } catch (error: any) {
    console.error(
      `Erro ao buscar inscrições estaduais do CGC ${cgc}:`,
      error,
    );
    throw error;
  }
}

// Função para buscar TODAS as inscrições estaduais (sem filtro de CGC)
export async function getAllInscricoesEstaduais(): Promise<InscricaoEstadual[]> {
  try {
    const response = await api.get('/api/inscricoesEstaduais/get?perPage=10000');
    return response.data.data || [];
  } catch (error: any) {
    console.error('Erro ao buscar todas as inscrições estaduais:', error);
    throw error;
  }
}

// Função para adicionar nova inscrição estadual
export async function addInscricaoEstadual(
  ie: Omit<InscricaoEstadual, 'inscricaoestadual'> & { inscricaoestadual: string },
): Promise<InscricaoEstadual> {
  try {
    const response = await api.post('/api/inscricoesEstaduais/add', ie);
    return response.data.data;
  } catch (error: any) {
    console.error('Erro ao adicionar inscrição estadual:', error);
    throw error;
  }
}

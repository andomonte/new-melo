import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { nfeService } from '../services/nfeService';
import { NFeRecebida, NFeFilters, NFeMeta } from '../types';

interface UseNFeParams {
  page: number;
  perPage: number;
  search: string;
  filters: NFeFilters;
}

interface UseNFeReturn {
  data: NFeRecebida[];
  meta: NFeMeta;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useNFe = (params: UseNFeParams): UseNFeReturn => {
  const [data, setData] = useState<NFeRecebida[]>([]);
  const [meta, setMeta] = useState<NFeMeta>({
    total: 0,
    pagina: 1,
    ultimaPagina: 1,
    porPagina: 10
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNFes = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Remover mock quando API estiver pronta
      // const response = await NFeService.list(params);
      
      // Mock data por enquanto
      const mockData: NFeRecebida[] = [
        {
          id: '1',
          xml: '35240412345678901234550010001234561123456789',
          docFiscal: '123456',
          serie: '001',
          dtEmissao: '2024-01-15',
          uf: 'SP',
          emitCpfCnpj: '12.345.678/0001-90',
          emitIe: '123456789',
          emitNome: 'FORNECEDOR EXEMPLO LTDA',
          emitMunicipio: 'SÃO PAULO',
          emitUf: 'SP',
          destCpfCnpj: '98.765.432/0001-10',
          status: 'RECEBIDA',
          dataRecebimento: '2024-01-15T10:30:00',
          valorTotal: 12500.50,
          qtdItens: 10
        },
        {
          id: '2',
          xml: '35240498765432109876550020002345672234567890',
          docFiscal: '789123',
          serie: '002',
          dtEmissao: '2024-01-16',
          uf: 'RJ',
          emitCpfCnpj: '98.765.432/0001-10',
          emitIe: '987654321',
          emitNome: 'OUTRO FORNECEDOR S.A.',
          emitMunicipio: 'RIO DE JANEIRO',
          emitUf: 'RJ',
          destCpfCnpj: '12.345.678/0001-90',
          status: 'PROCESSADA',
          dataRecebimento: '2024-01-16T14:20:00',
          valorTotal: 8750.00,
          qtdItens: 5,
          processadoPor: 'USUARIO_TESTE'
        }
      ];

      const mockMeta: NFeMeta = {
        total: mockData.length,
        pagina: params.page,
        ultimaPagina: 1,
        porPagina: params.perPage
      };

      setData(mockData);
      setMeta(mockMeta);
    } catch (err) {
      console.error('Erro ao carregar NFes:', err);
      setError('Erro ao carregar NFes');
      toast({
        title: 'Erro',
        description: 'Erro ao carregar NFes recebidas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params.page, params.perPage, params.search, params.filters, toast]);

  useEffect(() => {
    fetchNFes();
  }, [fetchNFes]);

  return {
    data,
    meta,
    loading,
    error,
    refetch: fetchNFes
  };
};
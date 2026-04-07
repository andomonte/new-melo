import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { entradasService } from '../services/entradasService';
import { EntradaDTO, EntradasFilters, EntradasMeta } from '../types';

interface UseEntradasParams {
  page: number;
  perPage: number;
  search: string;
  filters: EntradasFilters;
}

interface UseEntradasReturn {
  data: EntradaDTO[];
  meta: EntradasMeta;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useEntradas = (params: UseEntradasParams): UseEntradasReturn => {
  const [data, setData] = useState<EntradaDTO[]>([]);
  const [meta, setMeta] = useState<EntradasMeta>({
    total: 0,
    page: 1,
    perPage: 10,
    totalPages: 1,
    lastPage: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Estabilizar referencia de filters usando JSON.stringify
  const filtersKey = JSON.stringify(params.filters);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchEntradas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await entradasService.getEntradas(paramsRef.current);

      setData(response.data);
      setMeta({
        total: response.meta.total,
        page: response.meta.page,
        perPage: response.meta.perPage,
        totalPages: response.meta.totalPages || response.meta.lastPage,
        lastPage: response.meta.lastPage,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar entradas';
      setError(errorMessage);
      console.error('Erro ao carregar entradas:', err);

      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados das entradas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchEntradas();
  }, [params.page, params.perPage, params.search, filtersKey, fetchEntradas]);

  return {
    data,
    meta,
    loading,
    error,
    refetch: fetchEntradas,
  };
};
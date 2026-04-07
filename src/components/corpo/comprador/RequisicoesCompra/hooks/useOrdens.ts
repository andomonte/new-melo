import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/components/services/api';

interface UseOrdensParams {
  page?: number;
  perPage?: number;
  search?: string;
  filtros?: { campo: string; tipo: string; valor: string }[];
}

export const useOrdens = (params: UseOrdensParams = {}) => {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({
    total: 0,
    currentPage: 1,
    lastPage: 1,
    perPage: 25
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize params to avoid unnecessary re-renders
  const memoizedParams = useMemo(() => ({
    page: params.page || 1,
    perPage: params.perPage || 25,
    search: params.search || '',
    filtros: params.filtros || []
  }), [params.page, params.perPage, params.search, JSON.stringify(params.filtros || [])]);

  const fetchOrdens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      // Usar endpoint de filtros se há filtros, senão usar endpoint padrão
      if (memoizedParams.filtros && memoizedParams.filtros.length > 0) {
        console.log('🔍 useOrdens: Usando buscaOrdens com filtros:', memoizedParams.filtros);
        
        const filtrosCorrigidos = memoizedParams.filtros.map((filtro) => ({
          ...filtro,
          valor: String(filtro.valor), // sempre string para consistência
        }));

        response = await fetch('/api/ordens/buscaOrdens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: memoizedParams.page,
            perPage: memoizedParams.perPage,
            filtros: filtrosCorrigidos,
          }),
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar ordens com filtros');
        }

        const jsonResponse = await response.json();
        response = { data: jsonResponse }; // Adaptar formato para compatibilidade
      } else {
        console.log('📋 useOrdens: Usando /api/ordens/list padrão com parâmetros:', memoizedParams);
        response = await api.get('/api/ordens/list', { params: memoizedParams });
      }
      
      if (response.data?.success) {
        const dataArray = response.data.data || [];
        const responseMeta = response.data.meta || {};
        const total = responseMeta.total || response.data.total || dataArray.length || 0;
        const currentPage = responseMeta.currentPage || memoizedParams.page || 1;
        const perPage = responseMeta.perPage || memoizedParams.perPage || 25;
        const lastPage = responseMeta.lastPage || Math.ceil(total / perPage) || 1;
        
        console.log('✅ useOrdens: dados carregados:', {
          totalItems: dataArray.length,
          totalGeral: total,
          meta: { total, currentPage, lastPage, perPage }
        });
        
        setData(dataArray);
        setMeta({
          total,
          currentPage,
          lastPage,
          perPage
        });
      } else {
        throw new Error(response.data?.message || 'Erro ao carregar ordens');
      }
    } catch (err: any) {
      console.error('Erro ao buscar ordens:', err);
      setError(err.message || 'Erro ao carregar ordens');
      setData([]);
      setMeta({
        total: 0,
        currentPage: 1,
        lastPage: 1,
        perPage: memoizedParams.perPage || 25
      });
    } finally {
      setLoading(false);
    }
  }, [memoizedParams]);

  useEffect(() => {
    fetchOrdens();
  }, [fetchOrdens]);

  return {
    data,
    meta,
    loading,
    error,
    refetch: fetchOrdens,
  };
};
// src/components/corpo/comprador/RequisicoesCompra/hooks/useRequisitions.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import type { Meta } from '@/data/common/meta';
import { getRequisicoesCompra, getRequisicoesCompraCount, buscaRequisicoes } from '@/data/requisicoesCompra/requisicoesCompra';
import api from '@/components/services/api';

export function useRequisitions(params: {
  page: number;
  perPage: number;
  search: string;
  filtros?: { campo: string; tipo: string; valor: string }[]; // ← NOVO!
}) {
  const [data, setData] = useState<RequisitionDTO[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    currentPage: params.page,
    lastPage: 1,
    perPage: params.perPage,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // ← NOVA LÓGICA: Usar buscaRequisicoes se há filtros, senão usar função padrão
      if (params.filtros && params.filtros.length > 0) {
        const result = await buscaRequisicoes({
          page: params.page,
          perPage: params.perPage,
          filtros: params.filtros
        });

        // Verificar se a requisição foi cancelada
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        setData(result.data);
        setMeta(result.meta);
        setLoading(false);
        return; // ← Sair cedo quando usando filtros
      }

      // Usar chamada direta da API (igual ao hook das ordens)
      const response = await api.get('/api/requisicoesCompra/list', {
        params: {
          page: params.page,
          limit: params.perPage,  // API espera "limit", não "perPage"
          search: params.search
        }
      });
      
      if (response.data?.success) {
        const dataArray = response.data.data || [];
        const total = response.data.total || dataArray.length || 0;
        const currentPage = params.page || 1;
        const perPage = params.perPage || 25;
        const lastPage = Math.ceil(total / perPage) || 1;
        
        setData(dataArray);
        setMeta({
          total,
          currentPage,
          lastPage,
          perPage
        });
        setLoading(false);
        return;
      }
      
      // Fallback para lógica original se der erro
      const [dataResult, countResult] = await Promise.allSettled([
        getRequisicoesCompra(params),
        getRequisicoesCompraCount({ search: params.search })
      ]);

      // Verificar se a requisição foi cancelada
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (dataResult.status === 'fulfilled') {
        const res = dataResult.value;
        setData(res.data);

        let estimatedTotal = res.meta.total;
        let calculatedLastPage = 1;

        // Usar o total da contagem se disponível
        if (countResult.status === 'fulfilled' && countResult.value > 0) {
          estimatedTotal = countResult.value;
          calculatedLastPage = Math.ceil(countResult.value / params.perPage);
        }
        // Fallback se API retornou total = 0 mas temos dados
        else if (res.meta.total === 0 && res.data.length > 0) {
          if (res.data.length === params.perPage) {
            estimatedTotal = params.perPage * 10; // Estimativa conservadora
            calculatedLastPage = Math.ceil(estimatedTotal / params.perPage);
          } else {
            estimatedTotal = ((params.page - 1) * params.perPage) + res.data.length;
            calculatedLastPage = params.page;
          }
        }
        // Usar o total da API se disponível
        else if (res.meta.total > 0) {
          calculatedLastPage = Math.ceil(res.meta.total / params.perPage);
        }

        const correctedMeta = {
          ...res.meta,
          perPage: params.perPage,
          currentPage: params.page,
          total: estimatedTotal,
          lastPage: calculatedLastPage
        };

        setMeta(correctedMeta);
      } else {
        throw new Error(dataResult.reason?.message || 'Falha ao carregar requisições');
      }
    } catch (err: any) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      console.error('useRequisitions error:', err);
      setError(err.message || 'Falha ao carregar requisições');
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [params.page, params.perPage, params.search, JSON.stringify(params.filtros || [])]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, meta, loading, error, refetch: load };
}

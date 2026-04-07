import { useState, useEffect, useCallback, useMemo } from 'react';
import { NFeDTO, NFesMeta } from '../types';
import { nfeService } from '../services/nfeService';

interface NFeFiltersAdvanced {
  search?: string;
  status?: string[];
  fornecedor?: string;
  numeroNfe?: string;
  serieNfe?: string;
  chaveNfe?: string;
  dataInicio?: string;
  dataFim?: string;
  valorMinimo?: string;
  valorMaximo?: string;
  temAssociacao?: string;
}

interface UseNFesParams {
  page: number;
  perPage: number;
  search?: string;
  filters?: { campo: string; tipo: string; valor: string }[];
  advancedFilters?: NFeFiltersAdvanced;
}

interface UseNFesReturn {
  data: NFeDTO[];
  meta: NFesMeta;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateNFeStatus: (nfeId: string | number, newStatus: string) => void;
}

export const useNFes = ({ page, perPage, search, filters, advancedFilters }: UseNFesParams): UseNFesReturn => {
  const [data, setData] = useState<NFeDTO[]>([]);
  const [meta, setMeta] = useState<NFesMeta>({
    total: 0,
    page: 1,
    lastPage: 1,
    perPage: 10,
    currentPage: 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize params para evitar re-renders desnecessarios
  const memoizedParams = useMemo(() => ({
    page: page || 1,
    perPage: perPage || 10,
    search: search || '',
    filters: filters || []
  }), [page, perPage, search, JSON.stringify(filters || [])]);

  const fetchNFes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response;

      // OTIMIZADO: Usar endpoint de filtros se ha filtros, senao usar endpoint padrao
      if (memoizedParams.filters && memoizedParams.filters.length > 0) {
        console.log('useNFes: Usando buscaNFes com filtros:', memoizedParams.filters);

        const filtrosCorrigidos = memoizedParams.filters.map((filtro) => ({
          ...filtro,
          valor: String(filtro.valor),
        }));

        const fetchResponse = await fetch('/api/entrada-xml/buscaNFes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: memoizedParams.page,
            perPage: memoizedParams.perPage,
            search: memoizedParams.search,
            filtros: filtrosCorrigidos,
          }),
        });

        if (!fetchResponse.ok) {
          throw new Error('Erro ao buscar NFes com filtros');
        }

        const jsonResponse = await fetchResponse.json();

        if (!jsonResponse.success) {
          throw new Error(jsonResponse.message || 'Erro ao buscar NFes');
        }

        response = {
          data: jsonResponse.data || [],
          meta: jsonResponse.meta || {
            total: 0,
            page: memoizedParams.page,
            lastPage: 1,
            perPage: memoizedParams.perPage
          }
        };
      } else {
        // Sem filtros: usar endpoint padrao via nfeService
        console.log('useNFes: Usando /api/nfe padrao');
        response = await nfeService.getNFes({
          page: memoizedParams.page,
          perPage: memoizedParams.perPage,
          search: memoizedParams.search,
          filters: advancedFilters
        });
      }

      // Buscar status de associacao para as NFes retornadas
      if (response.data.length > 0) {
        try {
          const nfeIds = response.data.map((nfe: NFeDTO) => nfe.id).join(',');
          const statusResponse = await fetch(`/api/entrada-xml/nfe-status-associacao?nfeIds=${nfeIds}`);

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();

            if (statusData.success && statusData.data) {
              const statusMap = new Map(
                statusData.data.map((s: any) => [s.nfeId, s])
              );

              const dataWithStatus = response.data.map((nfe: NFeDTO) => ({
                ...nfe,
                statusAssociacao: statusMap.get(nfe.id) || {
                  totalItens: 0,
                  itensAssociados: 0,
                  percentual: 0,
                  status: 'NAO_INICIADA'
                }
              }));

              setData(dataWithStatus);
            } else {
              setData(response.data);
            }
          } else {
            setData(response.data);
          }
        } catch (statusErr) {
          console.error('Erro ao buscar status de associacao:', statusErr);
          setData(response.data);
        }
      } else {
        setData(response.data);
      }

      setMeta({
        ...response.meta,
        currentPage: response.meta.page
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar NFes');
      console.error('Erro ao carregar NFes:', err);
    } finally {
      setLoading(false);
    }
  }, [memoizedParams, advancedFilters]);

  useEffect(() => {
    fetchNFes();
  }, [fetchNFes]);

  const updateNFeStatus = (nfeId: string | number, newStatus: string) => {
    setData(prevData => {
      const updated = prevData.map(nfe => {
        const match = nfe.id === String(nfeId);
        return match ? { ...nfe, status: newStatus as NFeDTO['status'] } : nfe;
      });

      const found = updated.find(nfe => nfe.id === String(nfeId));
      if (!found) {
        console.warn(`⚠️ NFe ${nfeId} não encontrada na lista atual. IDs disponíveis:`, prevData.map(n => n.id));
      }

      return updated;
    });
  };

  return {
    data,
    meta,
    loading,
    error,
    refetch: fetchNFes,
    updateNFeStatus
  };
};
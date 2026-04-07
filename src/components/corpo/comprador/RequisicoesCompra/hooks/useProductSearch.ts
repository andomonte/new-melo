import { useState, useEffect } from 'react';
import api from '@/components/services/api';
import type { Produto, ProductSearchResult } from '../types';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';

interface UseProductSearchProps {
  search?: string;
  marca?: string;
  grupoproduto?: string;
  page?: number;
  perPage?: number;
}

interface UseProductSearchReturn {
  data: Produto[];
  meta: ProductSearchResult['meta'] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProductSearch({
  search = '',
  marca,
  grupoproduto,
  page = 1,
  perPage = 10,
}: UseProductSearchProps): UseProductSearchReturn {
  const [data, setData] = useState<Produto[]>([]);
  const [meta, setMeta] = useState<ProductSearchResult['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [isLoadingMore, setIsLoadingMore] = useState(false);

  const {
    // produtosCache,
    setProdutosCache,
    getProdutosCache,
    setLoadingProdutos,
  } = useRequisicaoStore();

  // Create cache key based on search parameters
  const createCacheKey = (params: UseProductSearchProps): string => {
    return JSON.stringify({
      search: params.search?.toLowerCase().trim(),
      marca: params.marca,
      grupoproduto: params.grupoproduto,
      page: params.page,
      perPage: params.perPage,
    });
  };

  const fetchProducts = async (loadMore = false) => {
    if (!search || search.trim().length < 2) {
      setData([]);
      setMeta(null);
      return;
    }

    const cacheKey = createCacheKey({ search, marca, grupoproduto, page, perPage });
    
    // Check cache first (only for non-load-more requests)
    if (!loadMore) {
      const cachedData = getProdutosCache(cacheKey);
      if (cachedData) {
        setData(cachedData);
        return;
      }
    }

    if (loadMore) {
      // setIsLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingProdutos(true);
    }
    setError(null);

    try {
      const params: any = {
        page,
        perPage,
      };

      // Handle different search types
      if (search.trim()) {
        // Check if it's a product code (numbers only) or general search
        if (/^\d+$/.test(search.trim())) {
          params.codprod = search.trim();
        } else {
          params.search = search.trim();
        }
      }

      if (marca) {
        params.marca = marca;
      }

      if (grupoproduto) {
        params.grupoproduto = grupoproduto;
      }

      const response = await api.get<{
        data: Produto[];
        meta: ProductSearchResult['meta'];
      }>('/api/compras/produtos', { params });

      const produtos = response.data.data || [];
      const metaData = response.data.meta;

      if (loadMore && page > 1) {
        // Append to existing data for load more
        setData(prevData => [...prevData, ...produtos]);
      } else {
        // Replace data for new search
        setData(produtos);
        // Cache the results
        setProdutosCache(cacheKey, produtos);
      }
      
      setMeta(metaData);

    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Erro ao buscar produtos. Tente novamente.');
      if (!loadMore) {
        setData([]);
        setMeta(null);
      }
    } finally {
      setLoading(false);
      setLoadingProdutos(false);
      // setIsLoadingMore(false);
    }
  };

  const refetch = async () => {
    await fetchProducts();
  };

  // Effect to trigger search when parameters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Check if this is a load more scenario
      const isLoadMore = page > 1 && data.length > 0;
      fetchProducts(isLoadMore);
    }, 100); // Small delay to avoid too many rapid calls

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, marca, grupoproduto, page, perPage]);

  // Reset page when search changes
  useEffect(() => {
    if (search !== undefined) {
      setData([]);
    }
  }, [search, marca, grupoproduto]);

  return {
    data,
    meta,
    loading,
    error,
    refetch,
  };
}
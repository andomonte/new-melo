import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';

const LOCAL_STORAGE_KEYS = {
  HEADERS: 'ordensCompra_headers',
  LIMIT: 'ordensCompra_limiteColunas',
};

export const useOrdensTableImproved = (colunas: any[]) => {
  const [inputSearch, setInputSearch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [headers, setHeaders] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState(5);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [filtros, setFiltros] = useState<{ campo: string; tipo: string; valor: string }[]>([]);

  // Initialize headers from localStorage
  useEffect(() => {
    const savedLimit = localStorage.getItem(LOCAL_STORAGE_KEYS.LIMIT);
    const initialLimit = savedLimit ? +savedLimit : 7;
    setLimiteColunas(initialLimit);

    // Force specific headers without selection column for orders
    // AÇÕES como primeira coluna, igual ao padrão NFe
    const defaultHeaders = [
      'AÇÕES',
      'ordem',
      'requisicao',
      'dataOrdem',
      'statusOrdem',
      'orc_pagamento_configurado',
      'fornecedor_completo',
      'comprador_completo',
    ];
    
    // Clear localStorage and force reset
    localStorage.removeItem(LOCAL_STORAGE_KEYS.HEADERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LIMIT);
    setHeaders(defaultHeaders);
    localStorage.setItem(LOCAL_STORAGE_KEYS.HEADERS, JSON.stringify(defaultHeaders));
    
    setIsInitialLoad(false);
  }, [colunas]);

  // Save headers to localStorage
  useEffect(() => {
    if (isInitialLoad) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.HEADERS, JSON.stringify(headers));
    // Subtract 1 for AÇÕES column only (no selecionar column)
    localStorage.setItem(LOCAL_STORAGE_KEYS.LIMIT, String(headers.length - 1));
    setLimiteColunas(headers.length - 1);
  }, [headers, isInitialLoad]);

  // Debounced search
  const debounced = useDebouncedCallback((v: string) => {
    setPage(1);
    setSearch(v);
  }, 500);

  const handleLimiteColunasChange = useCallback((novoLimite: number) => {
    setLimiteColunas(novoLimite);
    // AÇÕES como primeira coluna, igual ao padrão NFe
    const newHeaders = [
      'AÇÕES',
      ...colunas.slice(0, novoLimite).map((c) => c.campo), // Take first novoLimite columns (no selecionar)
    ];
    setHeaders(newHeaders);
    localStorage.setItem(LOCAL_STORAGE_KEYS.HEADERS, JSON.stringify(newHeaders));
    localStorage.setItem(LOCAL_STORAGE_KEYS.LIMIT, String(novoLimite));
  }, [colunas]);

  const handleColumnChange = useCallback((a: string, b: string, t?: "replace" | "swap" | "toggle" | undefined) => {
    // Prevent changes to fixed columns
    const fixedColumns = ['AÇÕES', 'acoes'];
    if (fixedColumns.includes(a) || fixedColumns.includes(b)) {
      return; // Don't allow changes to fixed columns
    }

    setHeaders((prev) => {
      const arr = [...prev];
      const iA = arr.indexOf(a);

      if (t === 'toggle') {
        if (iA > -1) {
          return arr.filter((h) => h !== a);
        } else {
          const newArr = [...arr];
          newArr.push(a);
          return newArr;
        }
      }

      const iB = arr.indexOf(b);
      if (t === 'swap' && iA > -1 && iB > -1) {
        [arr[iA], arr[iB]] = [arr[iB], arr[iA]];
      } else if (iA > -1) {
        arr[iA] = b;
      }
      return arr;
    });
  }, []);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputSearch(e.target.value);
  }, []);

  const handleSearchBlur = useCallback(() => {
    debounced(inputSearch);
  }, [inputSearch, debounced]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      debounced(inputSearch);
    }
  }, [inputSearch, debounced]);

  const handleFiltroChange = useCallback((novosFiltros: { campo: string; tipo: string; valor: string }[]) => {
    setFiltros(novosFiltros);
    setPage(1); // Reset to first page when filters change
  }, []);

  return {
    // State
    inputSearch,
    search,
    page,
    perPage,
    headers,
    limiteColunas,
    filtros,
    
    // Setters
    setPage,
    setPerPage,
    
    // Handlers
    handleLimiteColunasChange,
    handleColumnChange,
    handleSearch,
    handleSearchBlur,
    handleSearchKeyDown,
    handleFiltroChange,
  };
};
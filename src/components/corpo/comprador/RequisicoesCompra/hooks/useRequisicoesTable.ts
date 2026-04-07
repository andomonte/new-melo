import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';

const LOCAL_STORAGE_KEYS = {
  HEADERS: 'requisicoesCompra_headers',
  LIMIT: 'requisicoesCompra_limiteColunas',
};

export const useRequisicoesTable = (colunas: any[]) => {
  const [inputSearch, setInputSearch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [headers, setHeaders] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState(5);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [filtros, setFiltros] = useState<{ campo: string; tipo: string; valor: string }[]>([]);

  // Initialize headers from localStorage - apenas uma vez na montagem
  useEffect(() => {
    // CRÍTICO: Sempre usar os headers padrão com as colunas essenciais
    // AÇÕES como primeira coluna, igual ao padrão NFe
    const defaultHeaders = [
      'AÇÕES',
      'selecionar',
      'requisicao',
      'dataRequisicao',
      'statusRequisicao',
      'fornecedorCompleto',
      'compradorCompleto',
    ];
    
    // Verificar se há headers salvos, mas sempre garantir que fornecedor e comprador estejam presentes
    const savedHeaders = localStorage.getItem(LOCAL_STORAGE_KEYS.HEADERS);
    let finalHeaders = defaultHeaders; // Default fallback
    
    if (savedHeaders) {
      try {
        const parsed = JSON.parse(savedHeaders);
        
        // DEFENSIVE: Only use saved headers if they make sense (not too many, not too few)
        if (Array.isArray(parsed) && parsed.length >= 5 && parsed.length <= 15) {
          // CRÍTICO: Sempre garantir que as colunas essenciais estejam presentes
          // AÇÕES deve ser sempre a primeira coluna
          const essentialColumns = ['fornecedorCompleto', 'compradorCompleto', 'selecionar', 'AÇÕES'];
          let validHeaders = [...parsed];
          let needsRepair = false;

          essentialColumns.forEach(col => {
            if (!validHeaders.includes(col)) {
              needsRepair = true;

              if (col === 'AÇÕES') {
                validHeaders.unshift('AÇÕES'); // Add at beginning
              } else if (col === 'selecionar') {
                // Add after AÇÕES
                const acaoIndex = validHeaders.findIndex(h => h === 'AÇÕES');
                if (acaoIndex > -1) {
                  validHeaders.splice(acaoIndex + 1, 0, 'selecionar');
                } else {
                  validHeaders.unshift('selecionar');
                }
              } else {
                // Add at end for other essential columns
                validHeaders.push(col);
              }
            }
          });

          // Garantir que AÇÕES seja sempre a primeira
          if (validHeaders[0] !== 'AÇÕES') {
            validHeaders = validHeaders.filter(h => h !== 'AÇÕES');
            validHeaders.unshift('AÇÕES');
            needsRepair = true;
          }

          finalHeaders = validHeaders;
        }
      } catch (error) {
        // Parse error, use default headers
      }
    }
    
    setHeaders(finalHeaders);

    const savedLimit = localStorage.getItem(LOCAL_STORAGE_KEYS.LIMIT);
    const initialLimit = Math.max(5, finalHeaders.length - 2); // Account for selecionar and AÇÕES
    setLimiteColunas(savedLimit ? Math.max(5, +savedLimit) : initialLimit);
    
    setIsInitialLoad(false);
  }, []); // Sem dependências - roda apenas uma vez

  // Save headers to localStorage
  useEffect(() => {
    if (isInitialLoad) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.HEADERS, JSON.stringify(headers));
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
      'selecionar',
      ...colunas.slice(1, novoLimite + 1).map((c) => c.campo), // Skip selecionar column from colunas
    ];

    // CRÍTICO: Garantir que fornecedorCompleto e compradorCompleto estejam sempre incluídos
    const essentialColumns = ['fornecedorCompleto', 'compradorCompleto'];
    const finalHeaders = [...newHeaders];

    essentialColumns.forEach(col => {
      if (!finalHeaders.includes(col)) {
        finalHeaders.push(col);
      }
    });

    setHeaders(finalHeaders);
    localStorage.setItem(LOCAL_STORAGE_KEYS.HEADERS, JSON.stringify(finalHeaders));
    localStorage.setItem(LOCAL_STORAGE_KEYS.LIMIT, String(novoLimite));
  }, [colunas]);

  const handleColumnChange = useCallback((a: string, b: string, t?: "replace" | "swap" | "toggle" | undefined) => {
    // Prevent changes to fixed columns AND essential columns
    const fixedColumns = ['AÇÕES', 'selecionar', 'SELECIONAR', 'acoes'];
    const essentialColumns = ['fornecedorCompleto', 'compradorCompleto'];
    
    if (fixedColumns.includes(a) || fixedColumns.includes(b)) {
      return; // Don't allow changes to fixed columns
    }
    
    // CRÍTICO: Não permitir remover colunas essenciais via toggle
    if (t === 'toggle' && essentialColumns.includes(a)) {
      return;
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

    // CRÍTICO: Sempre manter fornecedorCompleto e compradorCompleto visíveis
    // Esta é uma correção para o bug reportado pelo usuário
    setHeaders(currentHeaders => {
      const mustHaveColumns = ['fornecedorCompleto', 'compradorCompleto'];
      let updatedHeaders = [...currentHeaders];

      // Se está aplicando filtros, garantir que as colunas essenciais estejam presentes
      if (novosFiltros.length > 0) {
        let needsUpdate = false;

        mustHaveColumns.forEach(col => {
          if (!updatedHeaders.includes(col)) {
            needsUpdate = true;
            updatedHeaders.push(col);
          }
        });

        // Garantir que AÇÕES seja sempre a primeira
        if (updatedHeaders[0] !== 'AÇÕES') {
          updatedHeaders = updatedHeaders.filter(h => h !== 'AÇÕES');
          updatedHeaders.unshift('AÇÕES');
          needsUpdate = true;
        }

        if (needsUpdate) {
          return updatedHeaders;
        }
      }

      return currentHeaders;
    });
  }, [headers]);

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
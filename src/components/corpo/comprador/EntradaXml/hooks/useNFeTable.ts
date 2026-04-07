import { useState, useCallback } from 'react';
import { ChangeEvent, KeyboardEvent } from 'react';

interface UseNFeTableReturn {
  search: string;
  page: number;
  perPage: number;
  filters: Record<string, any>;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  handleSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSearchBlur: () => void;
  handleSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleFilterChange: (key: string, value: any) => void;
  resetFilters: () => void;
}

export const useNFeTable = (): UseNFeTableReturn => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<Record<string, any>>({
    status: '',
    emitente: '',
    dataInicio: '',
    dataFim: ''
  });

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleSearchBlur = useCallback(() => {
    // Implementar lógica de blur se necessário
  }, []);

  const handleSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
    }
  }, []);

  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: '',
      emitente: '',
      dataInicio: '',
      dataFim: ''
    });
    setSearch('');
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  }, []);

  return {
    search,
    page,
    perPage,
    filters,
    setPage: handlePageChange,
    setPerPage: handlePerPageChange,
    handleSearch,
    handleSearchBlur,
    handleSearchKeyDown,
    handleFilterChange,
    resetFilters
  };
};
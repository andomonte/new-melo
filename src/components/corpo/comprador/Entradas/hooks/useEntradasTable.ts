import { useState, useCallback } from 'react';
import { ChangeEvent, KeyboardEvent } from 'react';
import { EntradasFilters } from '../types';

interface UseEntradasTableReturn {
  search: string;
  page: number;
  perPage: number;
  filters: EntradasFilters;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  handleSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSearchBlur: () => void;
  handleSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleFilterChange: (newFilters: Partial<EntradasFilters>) => void;
  resetFilters: () => void;
}

export const useEntradasTable = (): UseEntradasTableReturn => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<EntradasFilters>({});

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset para primeira página ao buscar
  }, []);

  const handleSearchBlur = useCallback(() => {
    // Lógica adicional se necessário
  }, []);

  const handleSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Busca será executada automaticamente pelo useEffect no useEntradas
    }
  }, []);

  const handleFilterChange = useCallback((newFilters: Partial<EntradasFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset para primeira página ao filtrar
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setSearch('');
    setPage(1);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset para primeira página ao mudar quantidade por página
  }, []);

  return {
    search,
    page,
    perPage,
    filters,
    setPage,
    setPerPage: handlePerPageChange,
    handleSearch,
    handleSearchBlur,
    handleSearchKeyDown,
    handleFilterChange,
    resetFilters,
  };
};
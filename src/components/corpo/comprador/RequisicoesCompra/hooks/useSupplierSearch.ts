import { useState, useEffect, useCallback } from 'react';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';
import api from '@/components/services/api';
import type { Fornecedor } from '../types';

export const useSupplierSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Fornecedor[]>([]);
  
  const {
    fornecedorSelecionado,
    getFornecedoresCache,
    setFornecedoresCache,
    setFornecedorSelecionado,
  } = useRequisicaoStore();

  // Buscar fornecedores na API
  const buscarFornecedores = useCallback(async (termo: string) => {
    if (termo.length < 2) {
      setSearchResults([]);
      return;
    }

    // Verificar cache primeiro
    const cached = getFornecedoresCache(termo);
    if (cached) {
      setSearchResults(cached);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.get('/api/compras/fornecedores', {
        params: { search: termo, perPage: 10 }
      });
      
      const fornecedores = response.data.fornecedores || [];
      setSearchResults(fornecedores);
      
      // Salvar no cache
      setFornecedoresCache(termo, fornecedores);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [getFornecedoresCache, setFornecedoresCache]);

  // Debounce da busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      buscarFornecedores(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, buscarFornecedores]);

  const selecionarFornecedor = useCallback((fornecedor: Fornecedor) => {
    setFornecedorSelecionado(fornecedor);
    setSearchTerm(`${fornecedor.cod_credor} - ${fornecedor.nome}`);
    setSearchResults([]);
  }, [setFornecedorSelecionado]);

  const limparSelecao = useCallback(() => {
    setFornecedorSelecionado(null);
    setSearchTerm('');
    setSearchResults([]);
  }, [setFornecedorSelecionado]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    fornecedorSelecionado,
    selecionarFornecedor,
    limparSelecao,
  };
};
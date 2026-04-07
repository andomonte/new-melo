import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, ChevronDown } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/components/services/api';

interface Fornecedor {
  cod_credor: string;
  nome: string;
  nome_fant?: string;
  cpf_cgc?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

interface FornecedorAutocompleteProps {
  value?: Fornecedor | null;
  onChange: (fornecedor: Fornecedor | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const FornecedorAutocomplete: React.FC<FornecedorAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Buscar fornecedor por código, nome ou CNPJ...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar fornecedores quando o search mudar
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      fetchFornecedores(debouncedSearch);
    } else {
      setFornecedores([]);
    }
  }, [debouncedSearch]);

  const fetchFornecedores = async (searchTerm: string) => {
    setLoading(true);
    try {
      const response = await api.get('/api/compras/fornecedores', {
        params: { search: searchTerm, perPage: 10 }
      });
      setFornecedores(response.data.fornecedores || []);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      setFornecedores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    setSelectedIndex(-1);
    
    if (!isOpen && newValue.length > 0) {
      setIsOpen(true);
    }
    
    // Se limpar o campo, limpar a seleção
    if (newValue === '' && value) {
      onChange(null);
    }
  };

  const handleFornecedorSelect = (fornecedor: Fornecedor) => {
    onChange(fornecedor);
    setSearch(`${fornecedor.cod_credor} - ${fornecedor.nome}`);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < fornecedores.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && fornecedores[selectedIndex]) {
          handleFornecedorSelect(fornecedores[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleFocus = () => {
    if (search.length >= 2) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay para permitir clique nas opções
    setTimeout(() => {
      if (!containerRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 200);
  };

  // Atualizar o campo quando value mudar externamente
  useEffect(() => {
    if (value) {
      setSearch(`${value.cod_credor} - ${value.nome}`);
    } else {
      setSearch('');
    }
  }, [value]);

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '';
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="p-3 text-center text-sm text-gray-500">
              Buscando fornecedores...
            </div>
          )}
          
          {!loading && debouncedSearch.length >= 2 && fornecedores.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum fornecedor encontrado
            </div>
          )}
          
          {!loading && debouncedSearch.length < 2 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {fornecedores.map((fornecedor, index) => (
            <button
              key={fornecedor.cod_credor}
              className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none ${
                index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
              }`}
              onClick={() => handleFornecedorSelect(fornecedor)}
            >
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                      {fornecedor.cod_credor}
                    </span>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {fornecedor.nome}
                    </span>
                  </div>
                  
                  {fornecedor.nome_fant && fornecedor.nome_fant !== fornecedor.nome && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {fornecedor.nome_fant}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {fornecedor.cpf_cgc && (
                      <span>CNPJ: {formatCNPJ(fornecedor.cpf_cgc)}</span>
                    )}
                    {fornecedor.cidade && fornecedor.uf && (
                      <span>{fornecedor.cidade}/{fornecedor.uf}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
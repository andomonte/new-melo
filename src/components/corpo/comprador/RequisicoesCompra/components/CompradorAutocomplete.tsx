import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import api from '@/components/services/api';

interface Comprador {
  codcomprador: string;
  nome: string;
}

interface CompradorAutocompleteProps {
  value?: { codigo: string; nome: string } | null;
  onChange: (codigo: string, nome: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const CompradorAutocomplete: React.FC<CompradorAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Buscar comprador por código ou nome...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar compradores quando o search mudar
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 2) {
      fetchCompradores(debouncedSearch);
    } else {
      setCompradores([]);
    }
  }, [debouncedSearch]);

  const fetchCompradores = async (searchTerm: string) => {
    setLoading(true);
    try {
      const response = await api.get('/api/compradores/get', {
        params: { search: searchTerm }
      });
      
      if (response.data?.data) {
        setCompradores(response.data.data);
      } else {
        setCompradores([]);
      }
    } catch (error) {
      console.error('Erro ao buscar compradores:', error);
      setCompradores([]);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar o campo de busca quando o valor mudar
  useEffect(() => {
    if (value) {
      setSearch(value.nome);
    } else {
      setSearch('');
    }
  }, [value]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < compradores.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : compradores.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < compradores.length) {
          selectComprador(compradores[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const selectComprador = (comprador: Comprador) => {
    onChange(comprador.codcomprador, comprador.nome);
    setSearch(comprador.nome);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    
    if (newValue.length === 0) {
      onChange('', '');
    }
    
    if (!isOpen && newValue.length > 0) {
      setIsOpen(true);
    }
  };

  const clearSelection = () => {
    onChange('', '');
    setSearch('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const displayValue = value ? value.nome : search;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <User className="h-4 w-4 text-gray-400" />
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
          autoComplete="off"
        />

        <div className="absolute inset-y-0 right-0 flex items-center">
          {value && (
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 text-gray-400 hover:text-gray-600 mr-1"
              disabled={disabled}
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-2 text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            <ChevronDown className={`h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="p-3 text-center text-sm text-gray-500">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Buscando compradores...</span>
              </div>
            </div>
          )}

          {!loading && (debouncedSearch || '').length >= 2 && compradores.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum comprador encontrado para &quot;{debouncedSearch}&quot;
            </div>
          )}

          {!loading && (debouncedSearch || '').length < 2 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {!loading && compradores.map((comprador, index) => (
            <button
              key={comprador.codcomprador}
              type="button"
              className={`w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-zinc-700 border-b border-gray-100 dark:border-zinc-700 last:border-0 ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => selectComprador(comprador)}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {comprador.nome}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Código: {comprador.codcomprador}
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
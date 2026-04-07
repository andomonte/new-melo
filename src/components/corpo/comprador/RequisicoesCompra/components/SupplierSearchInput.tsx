import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Building, User, FileText } from 'lucide-react';
import { useSupplierSearch } from '../hooks/useSupplierSearch';
import { formatCNPJ } from '../utils/formatters';
import type { Fornecedor } from '../types';

interface SupplierSearchInputProps {
  onSupplierSelect: (supplier: Fornecedor) => void;
  placeholder?: string;
  required?: boolean;
}

export const SupplierSearchInput: React.FC<SupplierSearchInputProps> = ({
  onSupplierSelect,
  placeholder = "Digite código, nome ou CNPJ do fornecedor...",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    fornecedorSelecionado,
    selecionarFornecedor,
    limparSelecao,
  } = useSupplierSearch();

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && searchResults[focusedIndex]) {
          handleSelectSupplier(searchResults[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(value.length >= 2);
    setFocusedIndex(-1);
  };

  const handleSelectSupplier = (supplier: Fornecedor) => {
    selecionarFornecedor(supplier);
    onSupplierSelect(supplier);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleClear = () => {
    limparSelecao();
    setIsOpen(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Fornecedor {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          />
          
          {/* Search icon */}
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
          />
          
          {/* Clear button */}
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-80 overflow-auto"
          >
            {isSearching && (
              <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Buscando fornecedores...
                </div>
              </div>
            )}

            {!isSearching && searchResults.length === 0 && searchTerm.length >= 2 && (
              <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                Nenhum fornecedor encontrado
              </div>
            )}

            {!isSearching && searchResults.map((supplier, index) => (
              <div
                key={supplier.cod_credor}
                onClick={() => handleSelectSupplier(supplier)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-zinc-700 last:border-b-0 ${
                  index === focusedIndex
                    ? 'bg-blue-50 dark:bg-zinc-700'
                    : 'hover:bg-gray-50 dark:hover:bg-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {supplier.cod_credor}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {supplier.nome}
                      </span>
                    </div>
                    
                    {supplier.nome_fant && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <User className="w-3 h-3" />
                        {supplier.nome_fant}
                      </div>
                    )}
                    
                    {supplier.cpf_cgc && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <FileText className="w-3 h-3" />
                        {formatCNPJ(supplier.cpf_cgc)}
                      </div>
                    )}

                    {supplier.cidade && supplier.uf && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {supplier.cidade} - {supplier.uf}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplier selected preview */}
      {fornecedorSelecionado && !isOpen && (
        <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-start gap-2">
            <Building className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-green-800 dark:text-green-200">
                {fornecedorSelecionado.cod_credor} - {fornecedorSelecionado.nome}
              </div>
              {fornecedorSelecionado.cpf_cgc && (
                <div className="text-green-600 dark:text-green-400">
                  CNPJ: {formatCNPJ(fornecedorSelecionado.cpf_cgc)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
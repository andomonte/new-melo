// src/components/common/SearchInput.tsx

import { Input } from '@/components/ui/input';
import React from 'react';
import { Search } from 'lucide-react'; // Importando o ícone de lupa

interface SearchInputProps {
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  value?: string; // Controle do valor atual
  onSearchIconClick?: () => void; // Nova prop para o clique no ícone
}

const SearchInput = ({
  placeholder,
  value,
  onChange,
  onKeyDown,
  onBlur,
  onSearchIconClick, // Recebendo a nova prop
}: SearchInputProps) => {
  return (
    // Um container para posicionar o ícone dentro do input
    <div className="relative flex items-center w-full">
      <Input
        type="search"
        value={value}
        placeholder={placeholder || 'Pesquisar...'}
        // Adicionamos 'pr-10' para dar espaço ao ícone dentro do input
        className="w-full px-2 py-1 border-b border-gray-300 dark:border-zinc-600 text-sm pr-10"
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {onSearchIconClick && ( // Renderiza o ícone apenas se a função de clique for fornecida
        <button
          type="button"
          onClick={onSearchIconClick} // Chama a função passada pelo pai (DataTable)
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
          aria-label="Pesquisar"
        >
          <Search size={18} /> {/* O ícone de lupa da lucide-react */}
        </button>
      )}
    </div>
  );
};

export default SearchInput;

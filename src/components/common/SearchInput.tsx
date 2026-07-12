import { Input } from '@/components/ui/input';
import React from 'react';

interface SearchInputProps {
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  /** Quando informado, o input passa a ser CONTROLADO (o texto reflete o valor). */
  value?: string;
}

const SearchInput = ({
  placeholder,
  onChange,
  onKeyDown,
  onBlur,
  value,
}: SearchInputProps) => {
  return (
    <Input
      type="text"
      placeholder={placeholder || 'Pesquisar...'}
      className="uppercase w-full px-2 py-1 h-7 border-b border-gray-300 dark:border-zinc-600 text-xs"
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      {...(value !== undefined ? { value } : {})}
    />
  );
};

export default SearchInput;

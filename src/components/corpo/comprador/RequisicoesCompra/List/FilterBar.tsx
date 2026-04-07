import React from 'react';
import { Input } from '@/components/ui/input';

interface FilterBarProps {
  value: string;
  onSearch: (value: string) => void;
  perPage: number;
  onPerPageChange: (perPage: number) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  value,
  onSearch,
  perPage,
  onPerPageChange,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <Input
        type="search"
        placeholder="Pesquisar..."
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        className="w-1/3"
      />
      <div className="flex items-center space-x-2">
        <label>Itens por página:</label>
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FilterBar;

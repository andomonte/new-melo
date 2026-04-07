/**
 * Componente de paginacao e controle de colunas
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SelectInput from '@/components/common/SelectInput2';
import { colunasDbEntrada } from '../colunasDbEntrada';
import { isColumnFixed } from '../helpers';
import { PER_PAGE_OPTIONS } from '../constants';

interface EntradasPaginationProps {
  page: number;
  perPage: number;
  lastPage: number;
  limiteColunas: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onLimiteColunasChange: (limite: number) => void;
}

export const EntradasPagination: React.FC<EntradasPaginationProps> = ({
  page,
  perPage,
  lastPage,
  limiteColunas,
  onPageChange,
  onPerPageChange,
  onLimiteColunasChange,
}) => {
  // Opcoes de quantidade de colunas
  const colunasOptions = Array.from(
    { length: colunasDbEntrada.filter(col => !isColumnFixed(col.campo)).length },
    (_, i) => ({
      label: `${i + 1}`,
      value: `${i + 1}`,
    })
  );

  return (
    <div className="flex-shrink-0 border-t border-gray-300 dark:border-zinc-500 bg-gray-200 dark:bg-zinc-800 px-2 py-3 min-h-[4rem]">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300 flex-shrink-0">
          {/* Select de Qtd. Itens */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Qtd. Itens:</span>
            <SelectInput
              name="itemsPagina"
              label=""
              value={perPage?.toString() ?? '25'}
              options={PER_PAGE_OPTIONS}
              onValueChange={val => onPerPageChange(parseInt(val))}
            />
          </div>

          {/* Select de Qtd. Colunas */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-sm font-medium whitespace-nowrap">Qtd. Colunas:</span>
            <SelectInput
              name="colunasPagina"
              label=""
              value={limiteColunas?.toString()}
              options={colunasOptions}
              onValueChange={val => onLimiteColunasChange(parseInt(val))}
            />
          </div>
        </div>

        <div className="flex gap-2 items-center text-sm flex-shrink-0">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="whitespace-nowrap text-sm">
            Pagina {page || 1} de {lastPage || 1}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === lastPage}
            className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

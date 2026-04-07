import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Meta } from '../../data/common/meta';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import SelectInput from './SelectInput2';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SearchInput from './SearchInput';
import Carregamento from '@/utils/carregamento';

interface DataTableProps {
  // Renomeado para evitar conflito com o nome da função
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
  loading?: boolean; // ADICIONADO: Nova prop 'loading'
  noDataMessage?: string; // ADICIONADO: Nova prop para a mensagem de sem dados
}

export default function DataTable({
  headers,
  rows,
  meta,
  onPageChange,
  onPerPageChange,
  onSearch,
  onSearchKeyDown,
  onSearchBlur,
  searchInputPlaceholder,
  loading, // DESESTRUTURANDO: A nova prop 'loading'
  noDataMessage = 'Nenhum dado encontrado.', // DESESTRUTURANDO: A nova prop 'noDataMessage' com valor padrão
}: DataTableProps) {
  // Usando o nome da interface atualizado
  const handlePreviousPage = () => {
    if (meta.currentPage > 1) {
      onPageChange(meta.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (meta.currentPage < meta.lastPage) {
      onPageChange(meta.currentPage + 1);
    }
  };

  const handlePerPageChangeInternal = (value: string) => {
    // Renomeado para evitar conflito com a prop
    if (onPerPageChange) {
      onPerPageChange(Number(value));
    }
  };

  const perPageOptions: { value: string; label: string }[] = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];

  const renderColGroup = () => {
    const totalCols = headers.length;
    const remainingCols = totalCols - 1; // Todas as colunas exceto "Ações"
    const remainingWidth = 95; // 100% - 5% (coluna Ações)
    const uniformColWidth = (remainingWidth / remainingCols).toFixed(2);

    return (
      <colgroup>
        {headers.map((_, index) => {
          if (index === 0) {
            // Coluna "Ações"
            return <col key={index} style={{ width: '5%' }} />;
          } else {
            // Todas as outras colunas com tamanho uniforme
            return <col key={index} style={{ width: `${uniformColWidth}%` }} />;
          }
        })}
      </colgroup>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Cabeçalho fixo */}
      <div className="flex-shrink-0">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableHeader>
            {/* Linha do input – cor normal */}
            <TableRow className="bg-white dark:bg-zinc-900">
              <TableCell colSpan={headers.length} className="border-none">
                <div className="flex justify-between items-center px-2">
                  <SearchInput
                    placeholder={
                      searchInputPlaceholder ??
                      'Pesquisar por cliente ou pedido...'
                    }
                    onChange={onSearch}
                    onKeyDown={onSearchKeyDown}
                    onBlur={onSearchBlur}
                  />
                </div>
              </TableCell>
            </TableRow>

            {/* Linha dos nomes das colunas – cor alterada */}
            <TableRow className="bg-gray-100 dark:bg-zinc-800">
              {headers.map((header, index) => (
                <TableHead
                  key={index}
                  className="font-bold text-center text-gray-700 dark:text-gray-200 uppercase border-none"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Corpo com scroll */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableBody>
            {loading ? ( // NOVO: Se estiver carregando, exibe o Carregamento
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 border-none"
                >
                  <Carregamento texto="Carregando dados..." />
                </TableCell>
              </TableRow>
            ) : rows?.length === 0 ? ( // NOVO: Se não estiver carregando E não houver linhas, exibe a mensagem de sem dados
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center border-none"
                >
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    {noDataMessage}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Se não estiver carregando E houver linhas, renderiza as linhas
              rows?.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 border-none"
                >
                  {Object.values(row).map((value: any, cellIndex: number) => (
                    <TableCell
                      key={cellIndex}
                      className="px-4 py-2 text-center border-none"
                    >
                      {value}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé fixo */}
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableFooter>
            <TableRow>
              <TableCell colSpan={headers.length} className="border-none">
                <div className="flex justify-between items-center px-2 py-0">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-sm">Qtd. Itens:</span>
                    <SelectInput
                      name="itemsPagina"
                      label=""
                      value={meta?.perPage?.toString() ?? ''}
                      options={perPageOptions}
                      onValueChange={handlePerPageChangeInternal}
                    />
                  </div>
                  <div className="flex gap-2 items-center text-sm">
                    <button
                      onClick={handlePreviousPage}
                      disabled={meta?.currentPage === 1}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="whitespace-nowrap">
                      Página {meta?.currentPage} de {meta?.lastPage}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={meta?.currentPage === meta?.lastPage}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

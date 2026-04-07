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

interface DataTable {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
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
}: DataTable) {
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

  const handlePerPageChange = (value: string) => {
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

  const calculateColumnWidth = (index: number, totalColumns: number) => {
    if (index === 0) {
      return '25%';
    }
    const remainingWidth = 100 - 25;
    const remainingColumns = totalColumns - 1;
    return `${remainingWidth / remainingColumns}%`;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden max-w-full flex flex-col h-[calc(100vh-10rem)]">
      {/* Cabeçalho fixo */}
      <div>
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          <TableHeader>
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
            <TableRow className="bg-gray-100 dark:bg-zinc-800">
              {headers.map((header, index) => (
                <TableHead
                  key={index}
                  className="font-bold text-center text-gray-700 dark:text-gray-200 uppercase border-none"
                  style={{ width: calculateColumnWidth(index, headers.length) }}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Corpo com scroll e margin-top: auto */}
      <div
        className="flex-grow overflow-y-auto py-0"
        style={{ marginTop: 'auto' }}
      >
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          <TableBody>
            {!Array.isArray(rows) ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 border-none "
                  style={{ height: 'calc(100vh - 16rem - 4rem)' }}
                >
                  <Carregamento texto="Carregando dados..." />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center border-none"
                >
                  Sem dados até o momento.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 border-none"
                >
                  {Object.values(row).map((value: any, cellIndex: number) => (
                    <TableCell
                      key={cellIndex}
                      className="px-4 py-2 text-center border-none"
                      style={{
                        width: calculateColumnWidth(cellIndex, headers.length),
                      }}
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
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
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
                      onValueChange={handlePerPageChange}
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

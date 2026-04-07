import React from 'react';
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
import SelectInput from './SelectInput2';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Carregamento from '@/utils/carregamento';

interface DataTableProps {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  carregando?: boolean;
}

export default function DataTable({
  headers,
  rows,
  meta,
  onPageChange,
  onPerPageChange,
  carregando = false,
}: DataTableProps) {
  const perPageOptions = ['10', '25', '50', '100'].map((v) => ({ value: v, label: v }));

  const handlePreviousPage = () => {
    if (meta.currentPage > 1) onPageChange(meta.currentPage - 1);
  };

  const handleNextPage = () => {
    if (meta.currentPage < meta.lastPage) onPageChange(meta.currentPage + 1);
  };

  const handlePerPageChange = (value: string) => {
    onPerPageChange(Number(value));
  };

  return (
    <div className="border border-zinc-700 bg-zinc-900 rounded-lg flex flex-col h-[calc(100vh-10rem)] w-full overflow-hidden">
      <div className="flex-grow overflow-y-auto">
        <Table className="w-full text-sm text-center">
          <TableHeader className="sticky top-0 z-10 bg-zinc-800">
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index} className="p-2 border-b border-zinc-700">
                  {header.toUpperCase()}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="p-4">
                  <Carregamento texto="Carregando..." />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="p-4">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i} className="odd:bg-zinc-900 even:bg-zinc-800">
                  {headers.map((key, j) => (
                    <TableCell key={j} className="px-2 py-1">
                      {row[key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-zinc-700 bg-zinc-800 px-2 py-1">
        <Table className="w-full">
          <TableFooter>
            <TableRow>
              <TableCell colSpan={headers.length} className="p-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
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
                      className="p-1 text-gray-300 hover:text-white disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      Página {meta?.currentPage} de {meta?.lastPage}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={meta?.currentPage === meta?.lastPage}
                      className="p-1 text-gray-300 hover:text-white disabled:opacity-40"
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

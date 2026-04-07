import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TabelaFaturasProps {
  faturas: any[];
  onSelect: (fatura: any) => void;
  currentPage: number;
  totalPages: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export default function TabelaFaturas({
  faturas,
  onSelect,
  currentPage,
  totalPages,
  perPage,
  onPageChange,
  onPerPageChange
}: TabelaFaturasProps) {
  const perPageOptions = [5, 10, 50, 100];

  const handlePreviousPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden max-w-full flex flex-col">
      <div className="flex-grow overflow-y-auto">
        <Table className="min-w-full text-sm text-center text-gray-200">
          <TableHeader>
            <TableRow className="bg-zinc-800">
              <TableHead>Status</TableHead>
              <TableHead>Nº Documento</TableHead>
              <TableHead>Nº Formulário</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Total Fatura</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Transportadora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faturas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-zinc-400">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              faturas.map((fatura, index) => {
                const getCorStatus = () => {
                  if (fatura.cancel === 'S') return 'bg-red-600';
                  if (fatura.denegada === 'S') return 'bg-black';
                  if (fatura.cobranca === 'N') return 'bg-pink-600';
                  if (fatura.agp === 'S') return 'bg-purple-600';
                  return 'bg-gray-600';
                };

                return (
                  <TableRow
                    key={index}
                    className="hover:bg-zinc-800 cursor-pointer"
                    onClick={() => onSelect(fatura)}
                  >
                    <TableCell>
                      <div className={`w-3 h-3 rounded-full mx-auto ${getCorStatus()}`} />
                    </TableCell>
                    <TableCell>{fatura.codfat}</TableCell>
                    <TableCell>{fatura.nroform}</TableCell>
                    <TableCell>{fatura.dbclien?.nome}</TableCell>
                    <TableCell>R$ {Number(fatura.totalnf || 0).toFixed(2)}</TableCell>
                    <TableCell>{fatura.data ? new Date(fatura.data).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{fatura.codvend}</TableCell>
                    <TableCell>{fatura.codtransp}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* FOOTER DE PAGINAÇÃO */}
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-zinc-800">
        <Table className="min-w-full table-auto text-sm text-center text-gray-200">
          <TableFooter>
            <TableRow>
              <TableCell colSpan={8} className="py-2">
                <div className="flex justify-between items-center px-4">
                  <div className="flex items-center gap-2">
                    <span>Qtd. Itens:</span>
                    <select
                      value={perPage}
                      onChange={(e) => onPerPageChange(Number(e.target.value))}
                      className="bg-zinc-800 text-white border border-zinc-600 rounded px-2 py-1 text-sm"
                    >
                      {perPageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center text-sm">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-40"
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

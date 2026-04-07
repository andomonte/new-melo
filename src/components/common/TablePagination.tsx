import { Meta } from '../../data/common/meta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationTableProps {
  handlePreviousPage: () => void;
  handleNextPage: () => void;
  meta: Meta;
}

export default function PaginationTable({
  handlePreviousPage,
  handleNextPage,
  meta,
}: PaginationTableProps) {
  return (
    <div className="flex gap-2 items-center text-sm">
      <button
        onClick={handlePreviousPage}
        disabled={meta?.currentPage === 1}
        className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-40"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-gray-700 whitespace-nowrap">
        Página {meta.currentPage} de {meta.lastPage}
      </span>
      <button
        onClick={handleNextPage}
        disabled={meta?.currentPage === meta.lastPage}
        className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-40"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

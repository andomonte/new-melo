import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  headers: string[];
  rows: any[];
  onRowClick?: (row: any) => void;
}

export default function DataTableSimples({ headers, rows, onRowClick }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden">
      <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
        <TableHeader>
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
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={headers.length}
                className="py-6 text-center border-none"
              >
                Nenhum produto encontrado.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className="cursor-pointer bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 border-none"
              >
             {Object.entries(row).map(([key, value], cellIndex) => {
  // Ignora campos auxiliares (como _original)
  if (key.startsWith('_')) return null;

  let displayValue: React.ReactNode;

  if (value === null || value === undefined) {
    displayValue = '—';
  } else if (typeof value === 'object') {
    // ⚠️ Impede objetos de aparecerem como JSON
    displayValue = '—';
  } else {
    // Convert to string to ensure ReactNode compatibility
    displayValue = String(value);
  }

  return (
    <TableCell
      key={cellIndex}
      className="px-4 py-2 text-center border-none"
    >
      {displayValue}
    </TableCell>
  );
})}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

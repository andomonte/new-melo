import * as React from 'react';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Carregamento from '@/utils/carregamento';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { DataTablePaginationClient } from './data-table/data-table-paginationCliente';

export type Payment = {
  codigo: string;
  nome: string | undefined;
  documento: string | undefined;
  nomeFantasia: string | undefined;
  saldo: number | undefined;
};

const toNumberBR = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'bigint') return Number(raw);

  const s = String(raw).trim();

  if (s.includes('.') && s.includes(',')) {
    const clean = s.replace(/\./g, '').replace(',', '.');
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }

  if (s.includes(',') && !s.includes('.')) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/* ---------------------------
 * Cabeçalho clicável: ASC ↔ DESC
 *  - 1º clique (sem ordenação) => ASC
 *  - clique sobre mesma coluna alterna ASC/DESC
 * --------------------------*/
const HeaderSort: React.FC<{ column: any; title: string }> = ({
  column,
  title,
}) => {
  const sorted = column.getIsSorted() as 'asc' | 'desc' | false;

  const handleClick = () => {
    // false/undefined => vai para ASC
    // ASC => vai para DESC
    // DESC => vai para ASC
    if (sorted === 'asc') {
      column.toggleSorting(true, false); // desc
    } else {
      column.toggleSorting(false, false); // asc (inclui o estado "sem ordenação")
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-1 select-none"
      title="Clique para ordenar"
    >
      <span className="text-sm">{title}</span>
      <span className="inline-flex">
        {sorted === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : sorted === 'desc' ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </span>
    </button>
  );
};

/* ---------------------------
 * COLUNAS (centralizadas)
 * Larguras controladas no <colgroup>
 * --------------------------*/
export const columns: ColumnDef<Payment>[] = [
  // Código (sem ordenação)
  {
    accessorKey: 'codigo',
    header: () => <span className="text-sm">Código</span>,
    cell: ({ row }) => (
      <div className="text-center">{row.getValue('codigo')}</div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  // Nome
  {
    accessorKey: 'nome',
    header: ({ column }) => <HeaderSort column={column} title="Nome" />,
    cell: ({ row }) => (
      <div className="uppercase text-center">{row.getValue('nome')}</div>
    ),
  },
  // Documento
  {
    accessorKey: 'documento',
    header: ({ column }) => <HeaderSort column={column} title="CPF/CNPJ" />,
    cell: ({ row }) => (
      <div className="uppercase text-center">{row.getValue('documento')}</div>
    ),
  },
  // Nome Fantasia
  {
    accessorKey: 'nomeFantasia',
    header: ({ column }) => (
      <HeaderSort column={column} title="Nome Fantasia" />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue('nomeFantasia')}</div>
    ),
  },
  // Saldo
  {
    id: 'saldo',
    accessorFn: (row: any) => row?.saldo,
    header: ({ column }) => <HeaderSort column={column} title="Saldo" />,
    cell: ({ row }) => {
      const n = toNumberBR(row.getValue<any>('saldo'));
      return (
        <div className="text-center">
          {n != null
            ? new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
              }).format(n)
            : '—'}
        </div>
      );
    },
  },
];

interface ChildProps {
  data2: {
    codigo: string;
    nome: string;
    documento: string;
    nomeFantasia: string;
    saldo: number;
  }[];
  clienteSelecionado: (index: string) => void;
  pagina: number;
  setPagina: (p: number) => void;
  tamanhoPagina: number;
  setTamanhoPagina: (t: number) => void;
  total: number;
  mudouPagina: ({ pagina, linhas }: { pagina: string; linhas: string }) => void;
  mudouOrdenacao: (o: {
    sortBy: string | null;
    sortDir: 'asc' | 'desc' | null;
  }) => void;
  loading: boolean;
}

const dataT: Payment[] = [
  { codigo: '', nome: '', documento: '', nomeFantasia: '', saldo: 0 },
];

const DataTablecolumns: React.FC<ChildProps> = ({
  data2,
  clienteSelecionado,
  tamanhoPagina,
  setTamanhoPagina,
  total,
  pagina,
  setPagina,
  mudouPagina,
  mudouOrdenacao,
  loading,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [data, setData] = React.useState(dataT);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    manualPagination: true,
    pageCount: Math.ceil(total / tamanhoPagina),
    state: {
      pagination: { pageIndex: pagina, pageSize: tamanhoPagina },
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onPaginationChange: (updater) => {
      const newState =
        typeof updater === 'function'
          ? updater({ pageIndex: pagina, pageSize: tamanhoPagina })
          : updater;
      setPagina(newState.pageIndex);
      setTamanhoPagina(newState.pageSize);
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // paginação → pai
  React.useEffect(() => {
    const { pageIndex, pageSize } = table.getState().pagination;
    mudouPagina({ pagina: String(pageIndex), linhas: String(pageSize) });
  }, [table, mudouPagina]);

  // ordenação → pai (server-side)
  React.useEffect(() => {
    const first = sorting?.[0];
    const sortBy = first?.id ?? null;
    const sortDir: 'asc' | 'desc' | null =
      typeof first?.desc === 'boolean' ? (first.desc ? 'desc' : 'asc') : null;

    // resetar para primeira página ao trocar ordenação
    if (sortBy && pagina !== 0) setPagina(0);

    mudouOrdenacao({ sortBy, sortDir });
  }, [sorting]); // eslint-disable-line react-hooks/exhaustive-deps

  // dados
  React.useEffect(() => {
    console.log('oi data 2', data2);
    if (data2.length) {
      setData(data2.map((v) => ({ ...v })));
    } else {
      setData(dataT);
    }
  }, [data2]);

  // Larguras: 1x, 4x, 2x, 3x, 2x (total 12x)
  const colWidths = ['8.3333%', '33.3333%', '16.6667%', '25%', '16.6667%'];

  return (
    <div className="w-full h-full relative">
      {/* Barra superior */}
      <div className="w-full border-t flex justify-center border-gray-300 h-12">
        <div className="flex w-full items-center">
          <div className="w-full font-bold text-orange-400 dark:text-orange-200 flex justify-center">
            LISTA DE CLIENTE
          </div>
          <div className="flex justify-center space-x-2 w-[21rem]"></div>
        </div>
      </div>

      <div className="border w-full flex justify-center items-center h-full">
        {/* h calc: ocupa a tela menos header (3rem ~ h-12) e footer (3rem) */}
        <div className="rounded-md border w-full h-full">
          <div className="flex flex-col w-full h-full border-b border-gray-300 dark:border-gray-800 min-h-0">
            <div className="flex-1 min-h-0 w-full overflow-auto">
              <table className="relative w-full min-w-full table-fixed border border-collapse">
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>

                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="sticky top-0 bg-gray-200 dark:bg-gray-500 px-3 py-3 text-center whitespace-nowrap"
                        >
                          <div className="w-full flex items-center justify-center gap-1">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody className="divide-y text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="h-96 text-center">
                        <Carregamento />
                      </td>
                    </tr>
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        className="hover:bg-muted/50"
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        onClick={() => clienteSelecionado(row.id)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-3 py-3 text-center align-middle"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="h-24 text-center">
                        No results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé de paginação (azul claro) */}
            <div className="h-12 w-full flex items-center border-t border-gray-300 justify-center bg-blue-100">
              <DataTablePaginationClient table={table} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTablecolumns;

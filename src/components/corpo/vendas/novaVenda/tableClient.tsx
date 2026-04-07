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
import { ChevronDown } from 'lucide-react';
import { DataTableColumnHeader } from './data-table/data-table-column-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTablePaginationClient } from './data-table/data-table-paginationCliente';

export type Payment = {
  codigo: string;
  nome: string | undefined;
  documento: string | undefined;
  nomeFantasia: string | undefined;
};

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'codigo',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-20  text-center text-sm"
        column={column}
        title="Código"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center min-w-20">{row.getValue('codigo')}</div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'nome',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-44  text-center text-sm"
        column={column}
        title="Nome"
      />
    ),
    cell: ({ row }) => (
      <div className="uppercase min-w-44">{row.getValue('nome')}</div>
    ),
  },
  {
    accessorKey: 'documento',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-36  text-center text-sm"
        column={column}
        title="CPF/CNPJ"
      />
    ),
    cell: ({ row }) => (
      <div className="uppercase min-w-36">{row.getValue('documento')}</div>
    ),
  },
  {
    accessorKey: 'nomeFantasia',
    header: ({ column }) => (
      <DataTableColumnHeader
        className="  text-center text-sm"
        column={column}
        title="Nome Fantasia"
      />
    ),
    cell: ({ row }) => <div className="">{row.getValue('nomeFantasia')}</div>,
  },
];

//interface EnumServiceItems extends Array<EnumServiceItem> {}

interface ChildProps {
  data2: {
    codigo: string;
    nome: string;
    documento: string;
    nomeFantasia: string;
  }[];
  clienteSelecionado: (index: string) => void;
  pagina: number;
  setPagina: (p: number) => void;
  tamanhoPagina: number;
  setTamanhoPagina: (t: number) => void;
  total: number;
  mudouPagina: ({ pagina, linhas }: { pagina: string; linhas: string }) => void;
  loading: boolean;
}

const dataT: Payment[] = [
  { codigo: '', nome: '', documento: '', nomeFantasia: '' },
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
  loading,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const [data, setData] = React.useState(dataT);
  //const [columns, setColumns] = React.useState(columnsT);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    manualPagination: true, // ← controle manual
    pageCount: Math.ceil(total / tamanhoPagina), // ← define o total de páginas baseado nos dados

    state: {
      pagination: { pageIndex: pagina, pageSize: tamanhoPagina },
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },

    // Atualiza o estado ao mudar página ou tamanho
    onPaginationChange: (updater) => {
      const newState =
        typeof updater === 'function'
          ? updater({ pageIndex: pagina, pageSize: tamanhoPagina })
          : updater;
      setPagina(newState.pageIndex);
      setTamanhoPagina(newState.pageSize);
    },

    // Eventos mantidos
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility, // ← importante para o dropdown "Configurar Coluna"
    onRowSelectionChange: setRowSelection, // ← importante se você quiser saber o item selecionado

    // Modelos da tabela
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  React.useEffect(() => {
    const { pageIndex, pageSize } = table.getState().pagination;
    mudouPagina({
      pagina: String(pageIndex),
      linhas: String(pageSize),
    });
  }, [table, mudouPagina]);

  React.useEffect(() => {
    if (data2.length) {
      const novoArr = data2?.map((val) => val);

      data2?.map((val, index) => {
        if (
          val?.codigo &&
          (val?.nome || val.nome === '') &&
          (val?.documento || val.documento === '') &&
          (val?.nomeFantasia || val.nomeFantasia === '')
        ) {
          novoArr[index].codigo = val?.codigo;
          novoArr[index].nome = val?.nome;
          novoArr[index].documento = val?.documento;
          novoArr[index].nomeFantasia = val?.nomeFantasia;
        }
        return 0;
      });
      setData(data2);
    }
  }, [data2]);

  return (
    <div className="w-[100%] h-full relative">
      <div className="w-full border-t flex justify-center border-gray-300 h-12 ">
        <div className=" flex w-[100%] items-center  ">
          <div className="flex justify-center  w-[21rem] ">
            <div className="">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-auto">
                    Configurar Coluna <ChevronDown className=" h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="w-full    font-bold text-orange-400 dark:text-orange-200 flex justify-center ">
            LISTA DE CLIENTE
          </div>
          <div className="flex justify-center space-x-2  w-[21rem]  "></div>
        </div>
      </div>
      <div className=" border w-[100%] flex justify-center items-center  h-[65vh] relative">
        <div className="rounded-md border w-[100%]  h-[100%]">
          <div className="flex flex-col w-full h-[100%] border-b border-gray-300 dark:border-gray-800">
            <div className="flex-grow w-full overflow-auto">
              <table className="relative w-full border">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <th
                            key={header.id}
                            className="sticky top-0  py-0  bg-gray-200 dark:bg-gray-500"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                {/* Único <tbody> — sem <div> dentro de <table> */}
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
                        onClick={() => {
                          const valorF = row.id;
                          clienteSelecionado(valorF);
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="py-4">
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
          </div>
          <div className="h-[10%] flex w-full items-center border-t border-gray-300 space-x-5 justify-center">
            <DataTablePaginationClient table={table} />
          </div>
        </div>
      </div>
    </div>
  );
};
export default DataTablecolumns;

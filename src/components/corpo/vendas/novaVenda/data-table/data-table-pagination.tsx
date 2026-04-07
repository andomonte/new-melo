import { type Table } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];

  readonly mudouPagina: (arg0: { pagina: string; linhas: string }) => void;
}

export function DataTablePagination<TData>({
  table,
  mudouPagina,
  pageSizeOptions = [10, 20, 30, 40, 50],
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center w-full  px-1">
      <div className="flex w-96 justify-start  text-muted-foreground">
        {table.getFilteredRowModel().rows.length}{' '}
        {Number(table.getFilteredRowModel().rows.length) > 1 ? 'Itens' : 'Item'}
      </div>
      <div className=" flex items-center w-full justify-end  lg:space-x-8">
        <div className="hidden sm:flex w-full items-center space-x-2">
          <p className="  font-medium">Linhas</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
              mudouPagina({
                pagina: String(table.getState().pagination.pageIndex),
                linhas: String(table.getState().pagination.pageSize),
              });
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full  justify-center ">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex "
              onClick={() => {
                table.setPageIndex(0);
                mudouPagina({
                  pagina: String(table.getState().pagination.pageIndex - 1),
                  linhas: String(table.getState().pagination.pageSize),
                });
              }}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4 " />
            </Button>

            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                table.previousPage();

                mudouPagina({
                  pagina: String(table.getState().pagination.pageIndex - 1),
                  linhas: String(table.getState().pagination.pageSize),
                });
              }}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex  items-center   font-medium">
              Pág {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                table.nextPage();
                mudouPagina({
                  pagina: String(table.getState().pagination.pageIndex + 1),
                  linhas: String(table.getState().pagination.pageSize),
                });
              }}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => {
                table.setPageIndex(table.getPageCount() - 1);
                mudouPagina({
                  pagina: String(table.getState().pagination.pageIndex + 1),
                  linhas: String(table.getState().pagination.pageSize),
                });
              }}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

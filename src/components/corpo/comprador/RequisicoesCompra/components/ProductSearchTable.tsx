import React, { useState, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { Search, Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DataTableFiltro from '@/components/common/DataTableFiltro';
import type { Produto, ProductSearchParams } from '../types';
import { useProductSearch } from '../hooks/useProductSearch';

interface ProductSearchTableProps {
  onSelectProduct: (produto: Produto) => void;
  isLoading?: boolean;
}

export const ProductSearchTable: React.FC<ProductSearchTableProps> = ({
  onSelectProduct,
  isLoading = false,
}) => {
  const [searchParams, setSearchParams] = useState<ProductSearchParams>({
    search: '',
    page: 1,
    perPage: 10,
  });

  const [debouncedSearch] = useDebounce(searchParams.search, 500);

  const { data, meta, loading, error } = useProductSearch({
    ...searchParams,
    search: debouncedSearch,
  });

  const handleSearch = useCallback((value: string) => {
    setSearchParams(prev => ({
      ...prev,
      search: value,
      page: 1, // Reset to first page on new search
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setSearchParams(prev => ({ ...prev, page }));
  }, []);

  const handlePerPageChange = useCallback((perPage: number) => {
    setSearchParams(prev => ({ ...prev, perPage, page: 1 }));
  }, []);

  // Table headers configuration
  const headers = [
    { key: 'codprod', label: 'Código', sortable: true },
    { key: 'ref', label: 'Referência', sortable: true },
    { key: 'descr', label: 'Descrição', sortable: true },
    { key: 'marca', label: 'Marca', sortable: true },
    { key: 'aplicacao', label: 'Aplicação', sortable: false },
    { key: 'estoque', label: 'Estoque', sortable: true },
    { key: 'prcompra', label: 'Preço Compra', sortable: true },
    { key: 'prvenda', label: 'Preço Venda', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false },
  ];

  // Format data for table
  const formatTableData = (produtos: Produto[]) => {
    return produtos.map((produto) => ({
      codprod: produto.codprod,
      ref: produto.ref || '-',
      descr: produto.descr,
      marca: produto.marca,
      aplicacao: produto.aplicacao ? (
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate block max-w-xs">
          {produto.aplicacao}
        </span>
      ) : '-',
      estoque: (
        <div className="text-center">
          <Badge 
            variant={produto.estoque && produto.estoque > 0 ? 'default' : 'destructive'}
            className="text-xs"
          >
            {produto.estoque}
          </Badge>
        </div>
      ),
      prcompra: produto.prcompra ? `R$ ${(Number(produto.prcompra) || 0).toFixed(2)}` : '-',
      prvenda: produto.prvenda ? `R$ ${(Number(produto.prvenda) || 0).toFixed(2)}` : '-',
      actions: (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectProduct(produto)}
            className="h-8 w-8 p-0"
            title="Adicionar produto"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ),
    }));
  };

  const rows = formatTableData(data);

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por código, descrição, marca..."
              value={searchParams.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              // TODO: Implement advanced filters
              console.log('Open advanced filters');
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      {meta && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Mostrando {data.length} de {meta.total} produtos
          {searchParams.search && (
            <span> para &quot;{searchParams.search}&quot;</span>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-md">
        <DataTableFiltro
          carregando={loading || isLoading}
          headers={headers.map(h => h.label)}
          rows={rows}
          meta={meta || { total: 0, lastPage: 1, currentPage: 1, perPage: 10 }}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => handleSearch(e.target.value)}
          searchInputPlaceholder="Buscar produtos..."
          limiteColunas={10}
          onLimiteColunasChange={() => {}}
        />
      </div>

      {/* Empty State */}
      {!loading && !error && data.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {searchParams.search ? (
            <div>
              <p>Nenhum produto encontrado para &quot;{searchParams.search}&quot;</p>
              <p className="text-sm mt-1">Tente ajustar os termos de busca</p>
            </div>
          ) : (
            <div>
              <p>Digite um termo para buscar produtos</p>
              <p className="text-sm mt-1">Busque por código, descrição ou marca</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
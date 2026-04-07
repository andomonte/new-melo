import React, { useState, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { Search, Plus, Filter, Package, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Produto, ProductSearchParams } from '../types';
import { useProductSearch } from '../hooks/useProductSearch';

interface ProductSearchTableImprovedProps {
  onSelectProduct: (produto: Produto) => void;
  isLoading?: boolean;
}

export const ProductSearchTableImproved: React.FC<ProductSearchTableImprovedProps> = ({
  onSelectProduct,
  isLoading = false,
}) => {
  const [searchParams, setSearchParams] = useState<ProductSearchParams>({
    search: '',
    page: 1,
    perPage: 12,
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
      page: 1,
    }));
  }, []);

  const handleLoadMore = useCallback(() => {
    if (meta && (searchParams.page || 1) < meta.lastPage) {
      setSearchParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }));
    }
  }, [meta, searchParams.page]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getStockColor = (stock: number) => {
    if (stock > 10) return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
    if (stock > 0) return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
  };

  const hasSearchResults = data.length > 0 || loading;
  const showNoResults = !loading && !error && debouncedSearch && data.length === 0;
  const showInitialState = !loading && !error && !debouncedSearch;

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Buscar Produtos
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Digite o código, descrição ou marca para encontrar produtos
            </p>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Ex: 12345, filtro de óleo, bosch..."
                value={searchParams.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-11"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
              )}
            </div>
            
            <Button variant="outline" className="h-11 px-4">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          {/* Search Stats */}
          {meta && hasSearchResults && (
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                <strong>{meta.total}</strong> produtos encontrados
              </span>
              {debouncedSearch && (
                <span>
                  para &quot;<strong>{debouncedSearch}</strong>&quot;
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800">
        {/* Error State */}
        {error && (
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Erro ao buscar produtos
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Initial State */}
        {showInitialState && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="bg-blue-100 dark:bg-blue-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Search className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Busque produtos para adicionar
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Digite o código, descrição ou marca do produto que você deseja adicionar à requisição.
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Exemplos de busca:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <code>12345</code> - Por código do produto</li>
                  <li>• <code>filtro óleo</code> - Por descrição</li>
                  <li>• <code>bosch</code> - Por marca</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {showNoResults && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nenhum produto encontrado
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Não encontramos produtos para &quot;{debouncedSearch}&quot;
              </p>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>Dicas para melhorar sua busca:</p>
                <ul className="text-left">
                  <li>• Verifique a grafia</li>
                  <li>• Use termos mais específicos</li>
                  <li>• Tente buscar por marca ou código</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {hasSearchResults && !error && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.map((produto) => (
                <Card
                  key={produto.codprod}
                  className="group bg-white dark:bg-slate-800 hover:shadow-lg transition-all duration-200 border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer"
                  onClick={() => onSelectProduct(produto)}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
                          {produto.descr}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Cód: {produto.codprod}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(produto);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      {/* Brand and Reference */}
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" className="text-xs">
                          {produto.marca_nome || produto.marca || produto.codmarca || 'Sem marca'}
                        </Badge>
                        {produto.ref && (
                          <span className="text-gray-500 dark:text-gray-400">
                            Ref: {produto.ref}
                          </span>
                        )}
                      </div>

                      {/* Stock */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Estoque:
                        </span>
                        <Badge 
                          className={`text-xs border ${getStockColor(produto.estoque || 0)}`}
                          variant="outline"
                        >
                          {produto.estoque}
                        </Badge>
                      </div>

                      {/* Prices */}
                      <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                        {/* Alert for zero purchase price */}
                        {Number(produto.prcompra) === 0 && (
                          <div className="mb-2">
                            <Badge className="w-full justify-center text-xs bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Preço de compra não cadastrado
                            </Badge>
                          </div>
                        )}

                        {Number(produto.prcompra) > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Compra:</span>
                            <span className="font-semibold text-green-700 dark:text-green-400">
                              {formatPrice(Number(produto.prcompra))}
                            </span>
                          </div>
                        )}
                        {Number(produto.prvenda) > 0 && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Venda:</span>
                            <span className="font-semibold text-blue-700 dark:text-blue-400">
                              {formatPrice(Number(produto.prvenda))}
                            </span>
                          </div>
                        )}
                        {Number(produto.prmedio) > 0 && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Médio:</span>
                            <span className="font-semibold text-purple-700 dark:text-purple-400">
                              {formatPrice(Number(produto.prmedio))}
                            </span>
                          </div>
                        )}
                        {Number(produto.prcompra) === 0 && Number(produto.prvenda) === 0 && Number(produto.prmedio) === 0 && (
                          <div className="text-center py-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">Preços não informados</span>
                          </div>
                        )}
                      </div>

                      {/* Application */}
                      {produto.aplicacao && (
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            <strong>Aplicação:</strong> {produto.aplicacao}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {meta && (searchParams.page || 1) < meta.lastPage && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="min-w-32"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    `Carregar mais (${meta.total - ((searchParams.page || 1) * (searchParams.perPage || 12))} restantes)`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
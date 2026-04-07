import React, { useState, useEffect, useCallback } from 'react';

import { RefreshCw, CheckCircle, Search, FileCheck } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons2';
import SearchInput from '@/components/common/SearchInput2';
import { Meta } from '@/data/common/meta';
import {
  PedidoConferido,
  getPedidosConferidos,
} from '@/data/conferencia/conferenciaService';
import { useToast } from '@/hooks/use-toast';
import CardPedidoConferido from './CardPedidoConferido';

const TelaFinalizar: React.FC = () => {
  const [pedidos, setPedidos] = useState<PedidoConferido[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const { toast } = useToast();

  // Meta para paginação
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    lastPage: 1,
    currentPage: 1,
    perPage: 12,
  });

  const loadPedidos = useCallback(async () => {
    setIsLoading(true);
    try {
      const pedidosData = await getPedidosConferidos();
      setPedidos(pedidosData);

      // Atualizar meta com os dados recebidos
      setMeta({
        total: pedidosData.length,
        lastPage: Math.ceil(pedidosData.length / perPage),
        currentPage: page,
        perPage: perPage,
      });
    } catch (error) {
      console.error('Erro ao carregar pedidos conferidos:', error);
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [perPage, page, toast]);

  // Função para filtrar e paginar pedidos para cards
  const getPedidosFiltradosEPaginados = () => {
    const pedidosFiltrados = pedidos.filter(
      (pedido) =>
        searchTerm === '' ||
        pedido.codvenda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.conferente.nome.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;

    return pedidosFiltrados.slice(startIndex, endIndex);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Resetar para primeira página ao pesquisar
  };

  // Carregar pedidos ao montar o componente
  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  // Atualizar meta quando dados mudarem
  useEffect(() => {
    const pedidosFiltrados = pedidos.filter(
      (pedido) =>
        searchTerm === '' ||
        pedido.codvenda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.conferente.nome.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    setMeta({
      total: pedidosFiltrados.length,
      lastPage: Math.ceil(pedidosFiltrados.length / perPage),
      currentPage: page,
      perPage: perPage,
    });
  }, [pedidos, searchTerm, page, perPage]);

  const pedidosParaExibir = getPedidosFiltradosEPaginados();

  // Estatísticas dos pedidos
  const totalPedidos = pedidos.length;

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 shadow-sm border-b border-gray-200 dark:border-zinc-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pedidos Conferidos
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Listagem de todos os pedidos que foram conferidos e finalizados
            </p>
          </div>

          <div className="flex gap-3">
            <DefaultButton
              text="Atualizar"
              size="sm"
              variant="secondary"
              onClick={loadPedidos}
              icon={<RefreshCw className="w-4 h-4" />}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Conferidos
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {totalPedidos}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Exibindo
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {pedidosParaExibir.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <Search className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Páginas
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {meta.lastPage}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Header da seção com busca */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Lista de Pedidos Conferidos
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {meta.total} pedido(s) encontrado(s)
                </p>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <SearchInput
                    placeholder="Pesquisar por número da venda, cliente, vendedor ou conferente..."
                    onChange={handleSearch}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Layout de Cards Responsivo */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Skeleton cards para loading */}
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  </div>
                  <div className="mb-4">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : pedidosParaExibir.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full">
                  <CheckCircle className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm
                  ? 'Nenhum pedido encontrado'
                  : 'Nenhum pedido conferido'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {searchTerm
                  ? 'Tente ajustar os termos de pesquisa ou limpe o filtro para ver todos os pedidos.'
                  : 'Não há pedidos conferidos no momento. Pedidos aparecerão aqui após serem finalizados no processo de conferência.'}
              </p>
              {searchTerm && (
                <DefaultButton
                  text="Limpar pesquisa"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearchTerm('')}
                />
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {pedidosParaExibir.map((pedido, index) => (
                  <CardPedidoConferido
                    key={pedido.codvenda}
                    pedido={pedido}
                    index={index}
                  />
                ))}
              </div>

              {/* Paginação */}
              {meta.lastPage > 1 && (
                <div className="flex justify-center items-center mt-8 space-x-2">
                  <DefaultButton
                    text="Anterior"
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  />

                  <div className="flex items-center space-x-1">
                    {Array.from(
                      { length: Math.min(meta.lastPage, 5) },
                      (_, i) => {
                        const pageNumber = i + 1;
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            className={`px-3 py-1 text-sm rounded ${
                              page === pageNumber
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <DefaultButton
                    text="Próxima"
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= meta.lastPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelaFinalizar;

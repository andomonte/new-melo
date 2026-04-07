import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Plus, Minus, ShoppingCart, Save, Send, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';

interface Produto {
  codprod: string;
  descr: string;
  marca: string;
  ref?: string;
  aplicacao?: string;
  estoque: number;
  prcompra: number;
  prvenda: number;
  multiplo?: number;
  grupoproduto?: string;
  unimed?: string;
}

interface ProdutoSelecionado extends Produto {
  quantidade: number;
  subtotal: number;
}

interface ProdutoSelecaoScreenProps {
  requisicaoId?: string;
  onCancel: () => void;
  onSave: (produtos: ProdutoSelecionado[]) => void;
  onSubmit: (produtos: ProdutoSelecionado[]) => void;
}

const ProdutoSelecaoScreen: React.FC<ProdutoSelecaoScreenProps> = ({
  requisicaoId,
  onCancel,
  onSave,
  onSubmit
}) => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [marca, setMarca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const { toast } = useToast();

  const fetchProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        search,
        marca,
        grupo
      });

      const response = await fetch(`/api/compras/produtos?${params}`);
      if (!response.ok) throw new Error('Erro ao buscar produtos');
      
      const data = await response.json();
      setProdutos(data.produtos);
      setTotal(data.meta.total);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar produtos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, marca, grupo, toast]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const adicionarProduto = (produto: Produto) => {
    const produtoExistente = produtosSelecionados.find(p => p.codprod === produto.codprod);
    
    if (produtoExistente) {
      setProdutosSelecionados(prev => 
        prev.map(p => 
          p.codprod === produto.codprod 
            ? { 
                ...p, 
                quantidade: p.quantidade + 1,
                subtotal: (p.quantidade + 1) * p.prcompra
              }
            : p
        )
      );
    } else {
      const novoProduto: ProdutoSelecionado = {
        ...produto,
        quantidade: 1,
        subtotal: produto.prcompra
      };
      setProdutosSelecionados(prev => [...prev, novoProduto]);
    }

    toast({
      title: "Produto adicionado",
      description: `${produto.descr} foi adicionado à requisição`,
    });
  };

  const atualizarQuantidade = (codprod: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerProduto(codprod);
      return;
    }

    setProdutosSelecionados(prev =>
      prev.map(p =>
        p.codprod === codprod
          ? {
              ...p,
              quantidade: novaQuantidade,
              subtotal: novaQuantidade * p.prcompra
            }
          : p
      )
    );
  };

  const removerProduto = (codprod: string) => {
    setProdutosSelecionados(prev => prev.filter(p => p.codprod !== codprod));
    toast({
      title: "Produto removido",
      description: "O produto foi removido da requisição",
    });
  };

  const calcularTotal = () => {
    return produtosSelecionados.reduce((total, produto) => total + produto.subtotal, 0);
  };

  const handleSalvar = () => {
    if (produtosSelecionados.length === 0) {
      toast({
        title: "Atenção",
        description: "Adicione pelo menos um produto à requisição",
        variant: "destructive"
      });
      return;
    }
    onSave(produtosSelecionados);
  };

  const handleSubmeter = () => {
    if (produtosSelecionados.length === 0) {
      toast({
        title: "Atenção", 
        description: "Adicione pelo menos um produto à requisição",
        variant: "destructive"
      });
      return;
    }
    onSubmit(produtosSelecionados);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-slate-800 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-700 border-b border-gray-200 dark:border-gray-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-[#347AB6]" />
            <div>
              <h1 className="text-xl font-bold text-[#347AB6] dark:text-gray-200">
                Seleção de Produtos
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Adicione produtos à sua requisição de compra
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Produtos */}
        <div className="flex-1 flex flex-col">
          {/* Filtros */}
          <div className="bg-white dark:bg-slate-700 p-4 border-b border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por código, descrição ou referência..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-[#347AB6] focus:border-[#347AB6] dark:bg-slate-600 dark:text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Filtrar por marca..."
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-[#347AB6] focus:border-[#347AB6] dark:bg-slate-600 dark:text-white"
              />
              <input
                type="text"
                placeholder="Filtrar por grupo..."
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-[#347AB6] focus:border-[#347AB6] dark:bg-slate-600 dark:text-white"
              />
            </div>
          </div>

          {/* Lista de Produtos */}
          <div className="flex-1 overflow-auto bg-white dark:bg-slate-700">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347AB6]"></div>
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {produtos.map((produto) => (
                  <div
                    key={produto.codprod}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-[#347AB6] text-white rounded-md flex items-center justify-center font-bold text-sm">
                              {produto.codprod.slice(-2)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {produto.ref} - {produto.descr}
                              </p>
                            </div>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-600 dark:text-gray-300 px-2 py-1 rounded">
                                {produto.marca}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Estoque: {produto.estoque}
                              </span>
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {formatarMoeda(produto.prcompra)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => adicionarProduto(produto)}
                          disabled={produto.estoque <= 0}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[#347AB6] hover:bg-[#2a5f94] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#347AB6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrinho de Produtos Selecionados */}
        <div className="w-96 bg-white dark:bg-slate-700 border-l border-gray-200 dark:border-gray-600 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-[#347AB6]" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Produtos Selecionados
              </h2>
              <span className="bg-[#347AB6] text-white text-xs font-medium px-2 py-1 rounded-full">
                {produtosSelecionados.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {produtosSelecionados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <ShoppingCart className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhum produto selecionado</p>
                <p className="text-xs text-gray-400 mt-1">
                  Clique em &quot;Adicionar&quot; para incluir produtos
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {produtosSelecionados.map((produto) => (
                  <div key={produto.codprod} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {produto.ref} - {produto.descr}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {produto.marca}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatarMoeda(produto.prcompra)} cada
                        </p>
                      </div>
                      <button
                        onClick={() => removerProduto(produto.codprod)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => atualizarQuantidade(produto.codprod, produto.quantidade - 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-medium">{produto.quantidade}</span>
                        <button
                          onClick={() => atualizarQuantidade(produto.codprod, produto.quantidade + 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatarMoeda(produto.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer com Total e Ações */}
          {produtosSelecionados.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-600 p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  Total:
                </span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatarMoeda(calcularTotal())}
                </span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleSalvar}
                  className="w-full flex items-center justify-center px-4 py-2 border border-[#347AB6] text-[#347AB6] bg-white hover:bg-gray-50 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500 rounded-md transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Rascunho
                </button>
                <button
                  onClick={handleSubmeter}
                  className="w-full flex items-center justify-center px-4 py-2 bg-[#347AB6] text-white hover:bg-[#2a5f94] rounded-md transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submeter para Aprovação
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProdutoSelecaoScreen;
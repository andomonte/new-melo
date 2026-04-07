import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormFooter2 from '@/components/common/FormFooter2';
import { useDebounce } from 'use-debounce';
import type { Produto } from '../types';
import api from '@/components/services/api';

interface ProdutoSelecionado extends Produto {
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacao?: string;
}

interface AdicionarProdutosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (produtos: ProdutoSelecionado[]) => void;
  produtosJaAdicionados?: ProdutoSelecionado[];
}

export const AdicionarProdutosModal: React.FC<AdicionarProdutosModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  produtosJaAdicionados = [],
}) => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [busca, setBusca] = useState('');
  const [debouncedBusca] = useDebounce(busca, 500);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalItens, setTotalItens] = useState(0);

  // Inicializar com produtos já adicionados se houver
  useEffect(() => {
    if (isOpen && produtosJaAdicionados.length > 0) {
      setProdutosSelecionados([...produtosJaAdicionados]);
    } else if (isOpen) {
      setProdutosSelecionados([]);
    }
  }, [isOpen, produtosJaAdicionados]);

  const buscarProdutos = async (termoBusca: string, paginaAtual: number = 1) => {
    setLoading(true);
    try {
      const response = await api.get('/api/compras/produtos', {
        params: {
          search: termoBusca,
          page: paginaAtual,
          perPage: 10,
        },
      });

      if (response.data?.data) {
        setProdutos(response.data.data);
        setTotalPaginas(response.data.meta?.lastPage || 1);
        setTotalItens(response.data.meta?.total || 0);
      } else {
        setProdutos([]);
        setTotalPaginas(1);
        setTotalItens(0);
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && debouncedBusca.trim()) {
      buscarProdutos(debouncedBusca, 1);
      setPagina(1);
    }
  }, [debouncedBusca, isOpen]);

  const handleBuscaChange = (value: string) => {
    setBusca(value);
  };

  const handlePaginaChange = (novaPagina: number) => {
    setPagina(novaPagina);
    buscarProdutos(debouncedBusca, novaPagina);
  };

  const adicionarProduto = (produto: Produto) => {
    const jaAdicionado = produtosSelecionados.find(p => p.codprod === produto.codprod);

    if (jaAdicionado) {
      // Se já está adicionado, incrementa quantidade
      setProdutosSelecionados(prev =>
        prev.map(p =>
          p.codprod === produto.codprod
            ? { ...p, quantidade: p.quantidade + 1, preco_total: (p.quantidade + 1) * p.preco_unitario }
            : p
        )
      );
    } else {
      // Adiciona novo produto
      const novoProduto: ProdutoSelecionado = {
        ...produto,
        quantidade: 1,
        preco_unitario: Number(produto.prcompra || 0),
        preco_total: Number(produto.prcompra || 0),
        observacao: '',
      };
      setProdutosSelecionados(prev => [...prev, novoProduto]);
    }
  };

  const removerProduto = (codprod: string) => {
    setProdutosSelecionados(prev => prev.filter(p => p.codprod !== codprod));
  };

  const alterarQuantidade = (codprod: string, delta: number) => {
    setProdutosSelecionados(prev => 
      prev.map(p => {
        if (p.codprod === codprod) {
          const novaQuantidade = Math.max(1, p.quantidade + delta);
          return {
            ...p,
            quantidade: novaQuantidade,
            preco_total: novaQuantidade * p.preco_unitario,
          };
        }
        return p;
      }).filter(p => p.quantidade > 0)
    );
  };

  const definirQuantidade = (codprod: string, quantidade: number) => {
    setProdutosSelecionados(prev =>
      prev.map(p => {
        if (p.codprod === codprod) {
          const novaQuantidade = Math.max(1, quantidade); // Mínimo 1
          return {
            ...p,
            quantidade: novaQuantidade,
            preco_total: novaQuantidade * p.preco_unitario,
          };
        }
        return p;
      })
    );
  };

  const alterarPreco = (codprod: string, novoPreco: number) => {
    setProdutosSelecionados(prev => 
      prev.map(p => {
        if (p.codprod === codprod) {
          return {
            ...p,
            preco_unitario: novoPreco,
            preco_total: p.quantidade * novoPreco,
          };
        }
        return p;
      })
    );
  };

  const handleConfirmar = () => {
    onConfirm(produtosSelecionados);
    onClose();
  };

  const handleLimpar = () => {
    setProdutosSelecionados([]);
    setBusca('');
    setProdutos([]);
  };

  const produtoEstaSelecionado = (codprod: string) => {
    return produtosSelecionados.some(p => p.codprod === codprod);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo - Replicando o padrão do sistema */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">Adicionar Produtos</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter2
              onSubmit={handleConfirmar}
              onClear={handleLimpar}
              isSaving={false}
              hasChanges={produtosSelecionados.length > 0}
              submitText="Adicionar à Compra"
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">
            
            {/* Campo de busca */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar produtos por código, descrição ou marca..."
                  value={busca}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  className="pl-10 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                  autoFocus
                />
              </div>
            </div>

            {/* Estatísticas */}
            {totalItens > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{totalItens}</strong> produtos encontrados para &quot;{debouncedBusca}&quot;
              </div>
            )}

            {/* Tabela de produtos */}
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-700/80 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">BUSCANDO DADOS</p>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">AÇÕES</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">PRODUTO</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">PREÇO UNIT.</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">QUANTIDADE</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">TOTAL</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">OBSERVAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.length === 0 && !loading && busca && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Nenhum produto encontrado para &quot;{debouncedBusca}&quot;. Tente uma busca diferente.
                        </td>
                      </tr>
                    )}
                    {produtos.length === 0 && !loading && !busca && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Digite algo para buscar produtos ou aplique filtros.
                        </td>
                      </tr>
                    )}
                    {produtos.map((produto) => {
                      const produtoSelecionado = produtosSelecionados.find(p => p.codprod === produto.codprod);
                      const estaSelecionado = produtoEstaSelecionado(produto.codprod);
                      
                      return (
                        <tr key={produto.codprod} className="border-b border-gray-100 dark:border-gray-600 hover:bg-blue-50/20 dark:hover:bg-zinc-700/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {estaSelecionado ? (
                                <button
                                  onClick={() => removerProduto(produto.codprod)}
                                  className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded flex items-center justify-center transition-colors"
                                  title="Remover produto"
                                >
                                  <span className="text-white text-xs font-bold">✕</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => adicionarProduto(produto)}
                                  className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Adicionar produto"
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {produto.descr}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                COD: {produto.codprod} | {produto.ref ? `Ref: ${produto.ref} | ` : ''}Disp: {Number(produto.estoque || 0)} | Marca: {produto.marca} | R$ {Number(produto.prcompra || 0).toFixed(2)}
                              </div>
                              {Number(produto.prcompra) === 0 && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                                    ⚠️ Preço de compra não cadastrado
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg border-2 border-blue-400 dark:border-blue-500 h-10" style={{ minWidth: '140px', maxWidth: '160px' }}>
                                <span className="pl-3 pr-1 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={produtoSelecionado?.preco_unitario || 0}
                                  onChange={(e) => alterarPreco(produto.codprod, Number(e.target.value))}
                                  className="flex-1 px-2 text-sm font-bold bg-transparent text-gray-900 dark:text-gray-100 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  style={{ minWidth: '0' }}
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">R$ {Number(produto.prcompra || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="flex items-stretch bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border-2 border-blue-400 dark:border-blue-500 h-10" style={{ width: '160px' }}>
                                <button
                                  onClick={() => alterarQuantidade(produto.codprod, -1)}
                                  className="w-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center justify-center text-lg font-bold text-white transition-colors"
                                  type="button"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={produtoSelecionado?.quantidade || 1}
                                  onChange={(e) => definirQuantidade(produto.codprod, Number(e.target.value))}
                                  className="flex-1 text-center text-sm font-bold bg-transparent text-gray-900 dark:text-gray-100 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  style={{ minWidth: '0' }}
                                />
                                <button
                                  onClick={() => alterarQuantidade(produto.codprod, 1)}
                                  className="w-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center justify-center text-lg font-bold text-white transition-colors"
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                                R$ {(produtoSelecionado?.preco_total || 0).toFixed(2)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <input
                                type="text"
                                placeholder="Observação..."
                                value={produtoSelecionado?.observacao || ''}
                                onChange={(e) => {
                                  setProdutosSelecionados(prev =>
                                    prev.map(p =>
                                      p.codprod === produto.codprod
                                        ? { ...p, observacao: e.target.value }
                                        : p
                                    )
                                  );
                                }}
                                className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 outline-none"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumo e Paginação */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-blue-200 dark:border-blue-800">
                {/* Total Geral */}
                <div className="flex items-center gap-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Produtos Selecionados: <span className="text-blue-600 dark:text-blue-400">{produtosSelecionados.length}</span>
                  </div>
                  {produtosSelecionados.length > 0 && (
                    <div className="text-base font-bold text-green-600 dark:text-green-400">
                      Total: R$ {produtosSelecionados.reduce((total, p) => total + (p.preco_total || 0), 0).toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Página {pagina} de {totalPaginas}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePaginaChange(pagina - 1)}
                        disabled={pagina <= 1}
                      >
                        ◀
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePaginaChange(pagina + 1)}
                        disabled={pagina >= totalPaginas}
                      >
                        ▶
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
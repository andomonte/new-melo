import React, { useState, useEffect } from 'react';
import { X, DollarSign, TrendingUp, Package, Loader2, AlertCircle, Edit3, RotateCcw, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';

const unidadeMedidaOptions = [
  { value: 'PC', label: 'Peça' },
  { value: 'UN', label: 'Unidade' },
  { value: 'KT', label: 'Kit' },
  { value: 'CX', label: 'Caixa' },
  { value: 'CJ', label: 'Conjunto' },
  { value: 'JG', label: 'Jogo' },
  { value: 'LT', label: 'Litro' },
  { value: 'ML', label: 'Mililitro' },
  { value: 'MT', label: 'Metro' },
  { value: 'PT', label: 'Pacote' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'CT', label: 'Cartela' },
  { value: 'PR', label: 'Par' },
  { value: 'RL', label: 'Rolo' },
];

interface ItemPreco {
  id?: string;
  produto_cod: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  preco_unitario_original: number;
  preco_total: number;
  editado: boolean;
  unidade_venda: string;
  unidade_original: string;
}

interface ConfirmarPrecoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (atualizarPrecoVenda: boolean, observacao: string, itensEditados?: ItemPreco[]) => void;
  numeroNF: string;
  entradaId: string;
  loading?: boolean;
}

export const ConfirmarPrecoModal: React.FC<ConfirmarPrecoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  numeroNF,
  entradaId,
  loading = false
}) => {
  const [atualizarPrecoVenda, setAtualizarPrecoVenda] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<ItemPreco[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [valorTotal, setValorTotal] = useState(0);

  // Buscar itens quando abrir o modal
  useEffect(() => {
    if (isOpen && entradaId) {
      fetchItens();
    }
  }, [isOpen, entradaId]);

  const fetchItens = async () => {
    setLoadingItens(true);
    try {
      const response = await fetch(`/api/entradas/${entradaId}/itens`);
      const result = await response.json();
      // API retorna { success, data, total }
      const items = result.data || result.itens || [];
      if (items.length > 0) {
        const mappedItems = items.map((item: any) => {
          const precoUnit = parseFloat(item.valor_unitario || item.precoUnitario || item.preco_unitario || 0);
          const qtd = parseFloat(item.quantidade || 0);
          const unidade = item.unimed || item.unidade_medida || item.unidade || 'UN';
          return {
            id: item.id?.toString() || '',
            produto_cod: item.produto_cod || item.produtoCod || '',
            produto_nome: item.produto_descricao || item.produtoNome || item.produto_nome || 'Produto',
            quantidade: qtd,
            preco_unitario: precoUnit,
            preco_unitario_original: precoUnit,
            preco_total: precoUnit * qtd,
            editado: false,
            unidade_venda: unidade,
            unidade_original: unidade,
          };
        });
        setItens(mappedItems);
        setValorTotal(mappedItems.reduce((acc: number, item: ItemPreco) => acc + item.preco_total, 0));
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    } finally {
      setLoadingItens(false);
    }
  };

  // Atualizar preco de um item
  const handlePrecoChange = (index: number, novoPreco: string) => {
    const valor = parseFloat(novoPreco) || 0;
    setItens(prev => {
      const updated = [...prev];
      const precoMudou = valor !== updated[index].preco_unitario_original;
      const unidadeMudou = updated[index].unidade_venda !== updated[index].unidade_original;
      updated[index] = {
        ...updated[index],
        preco_unitario: valor,
        preco_total: valor * updated[index].quantidade,
        editado: precoMudou || unidadeMudou,
      };
      return updated;
    });
  };

  // Atualizar unidade de medida de um item
  const handleUnidadeChange = (index: number, novaUnidade: string) => {
    setItens(prev => {
      const updated = [...prev];
      const precoMudou = updated[index].preco_unitario !== updated[index].preco_unitario_original;
      const unidadeMudou = novaUnidade !== updated[index].unidade_original;
      updated[index] = {
        ...updated[index],
        unidade_venda: novaUnidade,
        editado: precoMudou || unidadeMudou,
      };
      return updated;
    });
  };

  // Restaurar valores originais (preco e unidade)
  const handleRestaurarPreco = (index: number) => {
    setItens(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        preco_unitario: updated[index].preco_unitario_original,
        preco_total: updated[index].preco_unitario_original * updated[index].quantidade,
        unidade_venda: updated[index].unidade_original,
        editado: false,
      };
      return updated;
    });
  };

  // Recalcular total quando itens mudam
  useEffect(() => {
    setValorTotal(itens.reduce((acc, item) => acc + item.preco_total, 0));
  }, [itens]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    const itensEditados = itens.filter(i => i.editado);
    onConfirm(atualizarPrecoVenda, observacao, itensEditados.length > 0 ? itens : undefined);
  };

  const temItensEditados = itens.some(i => i.editado);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirmar Precos da Nota
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                NF {numeroNF}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Explicacao */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  O que significa "Confirmar Precos"?
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Ao confirmar, os precos de custo da nota fiscal serao usados para atualizar
                  o custo medio dos produtos no sistema. Isso afeta o calculo de margem e lucro.
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Itens com Precos */}
          <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Itens da Nota ({itens.length})
                  </span>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  Total: {formatCurrency(valorTotal)}
                </span>
              </div>
            </div>

            {loadingItens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-gray-600 dark:text-gray-400 font-medium">Produto</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Qtd</th>
                      <th className="text-center p-2 text-gray-600 dark:text-gray-400 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <Ruler className="w-3 h-3" />
                          Unidade
                        </div>
                      </th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <Edit3 className="w-3 h-3" />
                          Preco Unit.
                        </div>
                      </th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                    {itens.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-gray-100 dark:hover:bg-zinc-700/50 ${item.editado ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                        <td className="p-2">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {item.produto_cod}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                              {item.produto_nome}
                            </p>
                          </div>
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                          {item.quantidade}
                        </td>
                        <td className="p-2">
                          <select
                            value={item.unidade_venda}
                            onChange={(e) => handleUnidadeChange(idx, e.target.value)}
                            className={`w-20 px-2 py-1 text-center text-sm rounded border ${
                              item.unidade_venda !== item.unidade_original
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium'
                                : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white'
                            } focus:outline-none focus:ring-1 focus:ring-green-500`}
                          >
                            {unidadeMedidaOptions.map(opt => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                              >
                                {opt.value}
                              </option>
                            ))}
                          </select>
                          {item.unidade_venda !== item.unidade_original && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-0.5">
                              era {item.unidade_original}
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 text-xs">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.preco_unitario}
                              onChange={(e) => handlePrecoChange(idx, e.target.value)}
                              className={`w-24 px-2 py-1 text-right text-sm rounded border ${
                                item.editado
                                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium'
                                  : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white'
                              } focus:outline-none focus:ring-1 focus:ring-green-500`}
                            />
                            {item.editado && (
                              <button
                                onClick={() => handleRestaurarPreco(idx)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                title={`Restaurar: ${formatCurrency(item.preco_unitario_original)}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {item.editado && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 text-right mt-0.5">
                              era {formatCurrency(item.preco_unitario_original)}
                            </p>
                          )}
                        </td>
                        <td className="p-2 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.preco_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Opcoes */}
          <div className="space-y-3">
            {/* Checkbox: Atualizar Preco de Venda */}
            <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors">
              <input
                type="checkbox"
                checked={atualizarPrecoVenda}
                onChange={(e) => setAtualizarPrecoVenda(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-green-600 rounded border-gray-300 dark:border-zinc-600 focus:ring-green-500"
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    Atualizar Preco de Venda
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Recalcular preco de venda automaticamente: <strong>novo custo x margem cadastrada</strong>
                </p>
              </div>
            </label>

            {/* Observacao */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observacao (opcional)
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Precos conferidos com a nota fisica..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Aviso de itens editados */}
          {temItensEditados && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {itens.filter(i => i.editado).length} item(ns) com alteracao
                </span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Os precos e/ou unidades editados serao usados no lugar dos originais da nota.
              </p>
            </div>
          )}

          {/* Resumo da Acao */}
          <div className="bg-gray-100 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ao confirmar, o sistema ira:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Usar os precos {temItensEditados ? 'editados' : 'da nota'} para calcular o custo medio</li>
              <li>• Atualizar o custo atual no cadastro de produtos</li>
              {itens.some(i => i.unidade_venda !== i.unidade_original) && (
                <li className="text-blue-600 dark:text-blue-400">
                  • Atualizar unidade de medida dos produtos alterados
                </li>
              )}
              {atualizarPrecoVenda && (
                <li className="text-green-600 dark:text-green-400">
                  • Recalcular preco de venda (custo x margem)
                </li>
              )}
              <li>• Liberar entrada para <strong>RECEBIMENTO</strong> (criar romaneio automatico se necessario)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="dark:border-zinc-600 dark:text-gray-300 dark:hover:bg-zinc-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || loadingItens}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </span>
            ) : (
              'Confirmar Precos'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

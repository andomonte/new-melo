import React, { useState, useEffect } from 'react';
import { X, DollarSign, TrendingUp, Package, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ItemPreco {
  id?: string;
  produto_cod: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number; // Pç. Unit (dbitent.prunit)
  preco_nf: number;       // Pç. Unit NF (dbitent.prunitnf)
  custo: number;          // Custo dentro do estado (dbitent.prcusto)
  custo_zf: number;       // Custo Zona Franca (dbitent.prcusto_zf)
  custo_fe: number;       // Custo fora do estado (dbitent.prcusto_fe)
  preco_total: number;
  unidade_venda: string;
}

interface ConfirmarPrecoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (atualizarPrecoVenda: boolean, observacao: string, itensEditados?: ItemPreco[]) => void;
  numeroNF: string;
  entradaId: string;
  loading?: boolean;
}

/**
 * Confirmar Preço — SOMENTE LEITURA + confirmar (paridade com o Delphi, onde o
 * "Confirmar Entrada - Preço" é apenas uma confirmação: o custo vem da NF e o
 * cálculo/gravação é feito pelo motor CONFIRMAR_PRECO). O preço não é editável
 * aqui; a tela serve para conferir os itens/valores e confirmar.
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entradaId]);

  const fetchItens = async () => {
    setLoadingItens(true);
    try {
      const response = await fetch(`/api/entradas/${entradaId}/itens`);
      const result = await response.json();
      // API retorna { success, data, total }
      const items = result.data || result.itens || [];
      if (items.length > 0) {
        const mappedItems: ItemPreco[] = items.map((item: any) => {
          const precoUnit = parseFloat(item.valor_unitario || item.precoUnitario || item.preco_unitario || 0);
          const qtd = parseFloat(item.quantidade || 0);
          const unidade = item.unimed || item.unidade_medida || item.unidade || 'UN';
          return {
            id: item.id?.toString() || '',
            produto_cod: item.produto_cod || item.produtoCod || '',
            produto_nome: item.produto_descricao || item.produtoNome || item.produto_nome || 'Produto',
            quantidade: qtd,
            preco_unitario: precoUnit,
            preco_nf: parseFloat(item.preco_nf ?? precoUnit),
            custo: parseFloat(item.custo ?? 0),
            custo_zf: parseFloat(item.custo_zf ?? 0),
            custo_fe: parseFloat(item.custo_fe ?? 0),
            preco_total: precoUnit * qtd,
            unidade_venda: unidade,
          };
        });
        setItens(mappedItems);
        setValorTotal(mappedItems.reduce((acc, item) => acc + item.preco_total, 0));
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    } finally {
      setLoadingItens(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Somente leitura: não envia itens editados — o custo vem da NF (modelo Delphi).
    onConfirm(atualizarPrecoVenda, observacao);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirmar Preços da Nota
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
                  O que significa "Confirmar Preços"?
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Confira os itens e valores da nota. Ao confirmar, o <strong>Custo</strong> de cada
                  item entra na média ponderada do produto (afeta margem e lucro). Colunas (como no
                  Delphi): <strong>Pç. Unit</strong> = preço usado · <strong>Pç. NF</strong> = preço
                  da nota fiscal · <strong>Custo</strong> = custo já com IPI/ST/frete/desconto ·
                  <strong>Custo ZF</strong> (Zona Franca) e <strong>Custo FE</strong> (fora do estado).
                  Somente leitura.
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Itens com Precos (somente leitura) */}
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
              <div className="max-h-[45vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-gray-600 dark:text-gray-400 font-medium">Produto</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Qtd</th>
                      <th className="text-center p-2 text-gray-600 dark:text-gray-400 font-medium">Un.</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Pç. Unit</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Pç. NF</th>
                      <th className="text-right p-2 text-emerald-700 dark:text-emerald-400 font-semibold">Custo</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Custo ZF</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Custo FE</th>
                      <th className="text-right p-2 text-gray-600 dark:text-gray-400 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                    {itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-zinc-700/50">
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
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {item.quantidade}
                        </td>
                        <td className="p-2 text-center text-gray-700 dark:text-gray-300">
                          {item.unidade_venda}
                        </td>
                        <td className="p-2 text-right text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.preco_unitario)}
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatCurrency(item.preco_nf)}
                        </td>
                        <td className="p-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(item.custo)}
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatCurrency(item.custo_zf)}
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatCurrency(item.custo_fe)}
                        </td>
                        <td className="p-2 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
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
                    Atualizar Preço de Venda
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Recalcular preço de venda automaticamente: <strong>novo custo x margem cadastrada</strong>
                </p>
              </div>
            </label>

            {/* Observacao */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observação (opcional)
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Preços conferidos com a nota física..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Resumo da Acao */}
          <div className="bg-gray-100 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ao confirmar, o sistema irá:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Usar os preços da nota para calcular o custo médio</li>
              <li>• Atualizar o custo atual no cadastro de produtos</li>
              {atualizarPrecoVenda && (
                <li className="text-green-600 dark:text-green-400">
                  • Recalcular preço de venda (custo x margem)
                </li>
              )}
              <li>• Liberar entrada para <strong>RECEBIMENTO</strong> (criar romaneio automático se necessário)</li>
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
              'Confirmar Preços'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

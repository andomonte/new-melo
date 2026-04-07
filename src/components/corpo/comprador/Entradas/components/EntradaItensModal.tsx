import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Hash, Ruler, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntradaItem {
  id: string;
  produto_cod: string;
  produto_descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  unimed?: string;
}

interface EntradaItensModalProps {
  isOpen: boolean;
  entradaId: string;
  numeroEntrada: string;
  onClose: () => void;
}

export const EntradaItensModal: React.FC<EntradaItensModalProps> = ({
  isOpen,
  entradaId,
  numeroEntrada,
  onClose,
}) => {
  const [items, setItems] = useState<EntradaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && entradaId) {
      fetchItems();
    }
  }, [isOpen, entradaId]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/entradas/${entradaId}/itens`);
      const data = await response.json();

      if (data.success) {
        // API retorna data.data, não data.items
        setItems(data.data || data.items || []);
      } else {
        setError(data.error || 'Erro ao carregar itens');
        setItems([]);
      }
    } catch (err) {
      setError('Erro de comunicação com o servidor');
      console.error('Erro ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Itens da Entrada {numeroEntrada}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Visualização dos itens da entrada
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando itens...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-red-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Erro ao carregar</h3>
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
                <Button
                  onClick={fetchItems}
                  className="mt-4"
                  variant="outline"
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Nenhum item encontrado</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Esta entrada não possui itens cadastrados.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto">
              {/* Resumo no topo */}
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-blue-800 dark:text-blue-300">Resumo da Entrada</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-white dark:bg-slate-700 p-3 rounded">
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Total de Itens</span>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{items.length}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-700 p-3 rounded">
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Qtd. Total</span>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      {items.reduce((sum, item) => sum + item.quantidade, 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded border border-green-200 dark:border-green-800">
                    <span className="text-green-600 dark:text-green-400 block text-xs">Valor Total</span>
                    <p className="font-bold text-lg text-green-700 dark:text-green-300">
                      {formatCurrency(items.reduce((sum, item) => sum + item.valor_total, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabela de itens */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-slate-700">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Codigo
                        </div>
                      </th>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Descricao</th>
                      <th className="text-center p-3 font-semibold text-gray-700 dark:text-gray-300">
                        <div className="flex items-center justify-center gap-1">
                          <Ruler className="w-3 h-3" />
                          Un.
                        </div>
                      </th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Qtd</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3 h-3" />
                          Unit.
                        </div>
                      </th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="p-3">
                          <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                            {item.produto_cod}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700 dark:text-gray-300 max-w-[250px]">
                          <span className="line-clamp-2" title={item.produto_descricao}>
                            {item.produto_descricao || 'Descricao nao informada'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex px-2 py-0.5 bg-gray-100 dark:bg-slate-600 rounded text-xs font-medium text-gray-700 dark:text-gray-300">
                            {item.unimed || 'UN'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-gray-900 dark:text-white">
                          {item.quantidade.toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                          {formatCurrency(item.valor_unitario)}
                        </td>
                        <td className="p-3 text-right font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(item.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
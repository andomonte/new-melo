import React, { useState, useEffect } from 'react';
import { X, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ItemEstoque {
  produto_cod: string;
  produto_descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface ConfirmarEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (observacao: string) => void;
  entradaId: string;
  numeroNF: string;
  loading?: boolean;
}

export const ConfirmarEstoqueModal: React.FC<ConfirmarEstoqueModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entradaId,
  numeroNF,
  loading = false
}) => {
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  useEffect(() => {
    if (isOpen && entradaId) {
      carregarItens();
    }
  }, [isOpen, entradaId]);

  const carregarItens = async () => {
    setLoadingItens(true);
    try {
      const response = await fetch(`/api/entradas/${entradaId}/itens`);
      const data = await response.json();

      if (data.success && data.data) {
        setItens(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoadingItens(false);
    }
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(observacao);
  };

  const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValor = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Confirmar Estoque
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Atenção! Ação irreversível
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Ao confirmar o estoque da entrada <strong>{numeroNF}</strong>, os produtos serão liberados para venda e não poderá ser desfeito automaticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Itens */}
          {loadingItens ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : itens.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Itens que serão liberados ({itens.length})
                </h3>
                <div className="text-xs text-gray-500">
                  Total: {totalItens} un. | R$ {totalValor.toFixed(2)}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qtd</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Valor Un.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium text-gray-900">{item.produto_cod}</p>
                              <p className="text-xs text-gray-500 truncate">{item.produto_descricao}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900">
                            {item.quantidade}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            R$ {item.valor_unitario.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            R$ {(item.quantidade * item.valor_unitario).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhum item encontrado
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observação (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Estoque conferido e liberado para venda..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              disabled={loading}
            />
          </div>

          {/* Resumo da Ação */}
          <div className="bg-green-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs font-medium text-green-800">
                O que será feito:
              </p>
            </div>
            <ul className="text-xs text-green-700 space-y-1 ml-6">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Liberar estoque reservado (<code className="bg-white px-1 rounded">qtdreservada -= quantidade</code>)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Disponibilizar {totalItens} unidades para venda</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Mudar status da entrada para <strong>DISPONIVEL_VENDA</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>Registrar log da operação</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || itens.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processando...
              </span>
            ) : (
              'Confirmar Estoque'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

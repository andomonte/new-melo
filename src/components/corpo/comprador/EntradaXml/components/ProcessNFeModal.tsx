import React, { useState } from 'react';
import { X, Play, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MessageModal from '@/components/common/MessageModal';
import { NFeDTO } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';

interface ProcessNFeModalProps {
  isOpen: boolean;
  nfe: NFeDTO;
  onClose: () => void;
  onSuccess: () => void;
  loading?: boolean;
}

export const ProcessNFeModal: React.FC<ProcessNFeModalProps> = ({
  isOpen,
  nfe,
  onClose,
  onSuccess,
  loading = false
}) => {
  const [showMessage, setShowMessage] = useState(false);
  const [messageData, setMessageData] = useState({ title: '', message: '', type: 'info' as any });

  if (!isOpen) return null;

  const handleProcess = async () => {
    try {
      // Todos os itens são obrigatórios, processar todos
      // Chamar onSuccess que deve levar para a próxima tela (configuração)
      onSuccess();

    } catch (error) {
      console.error('Erro ao processar NFe:', error);
      setMessageData({
        title: 'Erro',
        message: 'Erro ao processar NFe. Por favor, tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    }
  };

  const totalValue = nfe.itens?.reduce((sum, item) => sum + item.valorTotal, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <Play className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Processar NFe {nfe.numeroNF}/{nfe.serie}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Informações da NFe */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Emitente
                </label>
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {nfe.emitente}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Data de Emissão
                </label>
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {formatDateTime(nfe.dataEmissao)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Valor Total
                </label>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {formatCurrency(nfe.valorTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* Aviso sobre processamento */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Atenção
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Todos os itens serão processados e associados às ordens de compra. A entrada no estoque será gerada em uma etapa futura.
                </p>
              </div>
            </div>
          </div>

          {/* Listagem de Itens */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Itens da NFe
              </h3>
            </div>

            {nfe.itens && nfe.itens.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Qtd
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor Unit.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {nfe.itens.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.codigo}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.descricao}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.quantidade}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {formatCurrency(item.valorUnitario)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {formatCurrency(item.valorTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Nenhum item encontrado na NFe
              </p>
            )}
          </div>

          {/* Resumo dos Itens */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-green-800 dark:text-green-200">
                  Total de Itens
                </label>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {nfe.itens?.length || 0}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-green-800 dark:text-green-200">
                  Valor Total
                </label>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleProcess}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Processando...' : 'Processar'}
          </Button>
        </div>
      </div>

      {/* Modal de mensagem */}
      <MessageModal
        isOpen={showMessage}
        onClose={() => setShowMessage(false)}
        title={messageData.title}
        message={messageData.message}
        type={messageData.type}
      />
    </div>
  );
};
import React from 'react';
import { X, FileText, Building, Calendar, DollarSign, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NFeDTO } from '../types';
import { formatCurrency, formatDateTime, getNFeStatusLabel, getNFeStatusColor, formatCNPJ } from '../utils/formatters';

interface ViewNFeModalProps {
  isOpen: boolean;
  nfe: NFeDTO;
  onClose: () => void;
}

export const ViewNFeModal: React.FC<ViewNFeModalProps> = ({
  isOpen,
  nfe,
  onClose
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyChave = async () => {
    if (nfe.chaveNFe) {
      await navigator.clipboard.writeText(nfe.chaveNFe);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detalhes da NFe {nfe.numeroNF}/{nfe.serie}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Status e Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Informações da NFe
                </h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Número/Série
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {nfe.numeroNF}/{nfe.serie}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Chave NFe
                  </label>
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-gray-900 dark:text-white font-mono break-all flex-1">
                      {nfe.chaveNFe}
                    </p>
                    <button
                      onClick={handleCopyChave}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                      title={copied ? 'Copiado!' : 'Copiar chave'}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getNFeStatusColor(nfe.status)}`}>
                      {getNFeStatusLabel(nfe.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Dados do Emitente
                </h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Razão Social
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {nfe.emitente}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    CNPJ
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatCNPJ(nfe.cnpjEmitente)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Informações Financeiras e Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Valores
                </h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Valor Total
                  </label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(nfe.valorTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Datas
                </h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Data de Emissão
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDateTime(nfe.dataEmissao)}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Data de Upload
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDateTime(nfe.dataUpload)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Itens da NFe */}
          {nfe.itens && nfe.itens.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Itens da NFe ({nfe.itens.length})
              </h3>
              
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-600">
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
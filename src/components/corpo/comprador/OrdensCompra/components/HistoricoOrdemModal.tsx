/**
 * Modal de Histórico de Ordem de Compra
 *
 * Exibe timeline de todas as alterações realizadas na ordem
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { X, Clock, User, MessageSquare, ArrowRight, FileText } from 'lucide-react';
import api from '@/components/services/api';
import { parseComentarioHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';
import ReactMarkdown from 'react-markdown';
import { formatCurrency } from '@/components/corpo/comprador/EntradaXml/utils/formatters';

interface HistoricoOrdemItem {
  id: number;
  orc_id: number;
  previous_status: string;
  new_status: string;
  user_id: string;
  user_name: string;
  reason: string | null;
  comments: string | null;
  created_at: string;
  status_label_anterior: string;
  status_label_novo: string;
}

interface OrdemInfo {
  orc_id: number;
  req_id_composto: string;
  fornecedor: string;
  status: string;
  valor_total: number;
}

interface HistoricoOrdemModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordemId: number;
  ordemNumero?: string;
}

export const HistoricoOrdemModal: React.FC<HistoricoOrdemModalProps> = ({
  isOpen,
  onClose,
  ordemId,
  ordemNumero
}) => {
  const [historico, setHistorico] = useState<HistoricoOrdemItem[]>([]);
  const [ordem, setOrdem] = useState<OrdemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ordemId) {
      loadHistorico();
    }
  }, [isOpen, ordemId]);

  const loadHistorico = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/ordens/${ordemId}/historico`);

      if (response.data.success) {
        setHistorico(response.data.data || []);
        setOrdem(response.data.ordem || null);
      } else {
        setError(response.data.message || 'Erro ao carregar histórico');
      }
    } catch (err: any) {
      console.error('Erro ao carregar histórico:', err);
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '':
      case 'Criação':
        return 'bg-purple-500';
      case 'P':
      case 'Pendente':
        return 'bg-yellow-500';
      case 'A':
      case 'Aberta':
        return 'bg-green-500';
      case 'B':
      case 'Bloqueada':
        return 'bg-orange-500';
      case 'C':
      case 'Cancelada':
        return 'bg-red-500';
      case 'F':
      case 'Fechada':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const renderComment = (comment: string | null) => {
    if (!comment) return null;

    const parsed = parseComentarioHistoricoOrdem(comment);

    if (parsed && parsed.descricao_legivel) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
              ),
              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
              li: ({ children }) => <li className="mb-1">{children}</li>
            }}
          >
            {parsed.descricao_legivel}
          </ReactMarkdown>
        </div>
      );
    } else {
      return <p className="text-sm text-gray-700 dark:text-gray-300">{comment}</p>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Histórico da Ordem de Compra
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {ordemNumero || ordem?.req_id_composto || `Ordem #${ordemId}`}
              {ordem && (
                <span className="ml-2">
                  - {ordem.fornecedor}
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    ({formatCurrency(ordem.valor_total)})
                  </span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando histórico...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-red-500 text-sm mb-2">{error}</div>
                <button
                  onClick={loadHistorico}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <Clock className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum histórico encontrado</p>
              <p className="text-sm">Esta ordem ainda não possui registros de alteração.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {historico.map((item, index) => (
                  <div key={item.id} className="relative">
                    {/* Timeline line */}
                    {index < historico.length - 1 && (
                      <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>
                    )}

                    {/* Timeline item */}
                    <div className="flex items-start space-x-4">
                      {/* Timeline dot */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-zinc-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-gray-50 dark:bg-zinc-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {/* Status transition */}
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(
                                  item.previous_status
                                )}`}
                              >
                                {item.status_label_anterior}
                              </span>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                              <span
                                className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(
                                  item.new_status
                                )}`}
                              >
                                {item.status_label_novo}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        {/* User info */}
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {item.user_name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({item.user_id})
                          </span>
                        </div>

                        {/* Reason */}
                        {item.reason && (
                          <div className="mb-2">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <strong>Motivo:</strong> {item.reason}
                            </p>
                          </div>
                        )}

                        {/* Comments */}
                        {item.comments && (
                          <div className="flex items-start space-x-2">
                            <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <strong>Detalhes:</strong>
                              </p>
                              <div className="mt-1 bg-white dark:bg-zinc-600 p-3 rounded border border-gray-200 dark:border-gray-500">
                                {renderComment(item.comments)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoricoOrdemModal;

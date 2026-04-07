import React, { useState, useEffect } from 'react';
import { X, Clock, User, MessageSquare, ArrowRight, ChevronDown, ChevronUp, Package, Plus, Minus, Edit3, RefreshCw } from 'lucide-react';
import api from '@/components/services/api';
import { parseComentarioHistorico } from '@/lib/compras/historicoHelper';
import ReactMarkdown from 'react-markdown';

interface HistoricoItem {
  id: number;
  req_id: number;
  req_versao: number;
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

interface HistoricoModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisitionId: number;
  requisitionVersion?: number;
  requisitionNumber?: string;
}

export const HistoricoModal: React.FC<HistoricoModalProps> = ({
  isOpen,
  onClose,
  requisitionId,
  requisitionVersion,
  requisitionNumber
}) => {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && requisitionId) {
      loadHistorico();
    }
  }, [isOpen, requisitionId, requisitionVersion]);

  const loadHistorico = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = requisitionVersion 
        ? `/api/requisicoesCompra/${requisitionId}/historico?versao=${requisitionVersion}`
        : `/api/requisicoesCompra/${requisitionId}/historico`;
        
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        setHistorico(response.data.data || []);
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
      case '': case 'Criação': return 'bg-purple-500';
      case 'P': case 'Pendente': return 'bg-yellow-500';
      case 'S': case 'Submetida': return 'bg-blue-500';
      case 'A': case 'Aprovada': return 'bg-green-500';
      case 'R': case 'Rejeitada': return 'bg-red-500';
      case 'C': case 'Cancelada': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  // Helper para formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Componente para renderizar itens em lote com accordion
  const ItemsAccordion: React.FC<{ dados: any }> = ({ dados }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const itens = dados?.itens || [];
    const totalItens = dados?.total_itens || itens.length;
    const totalValor = dados?.total_valor || 0;

    return (
      <div className="space-y-2">
        {/* Header com resumo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {totalItens} produto(s) adicionado(s)
            </span>
          </div>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            Total: {formatCurrency(totalValor)}
          </span>
        </div>

        {/* Accordion toggle */}
        {itens.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar itens
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Ver {itens.length} item(ns)
              </>
            )}
          </button>
        )}

        {/* Lista de itens expandida */}
        {isExpanded && itens.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-zinc-600 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Produto</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-700 dark:text-gray-200 w-16">Qtd</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 dark:text-gray-200 w-24">Unit.</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 dark:text-gray-200 w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                {itens.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={item.descr}>
                        {item.descr || item.codprod}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {item.ref ? `Ref: ${item.ref}` : `Cod: ${item.codprod}`}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300">
                      {item.quantidade}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(item.preco_unitario || 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(item.preco_total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Componente para item individual adicionado/removido
  const SingleItemCard: React.FC<{ dados: any; tipo: string }> = ({ dados, tipo }) => {
    const isRemocao = tipo === 'REMOCAO_ITEM';
    const Icon = isRemocao ? Minus : Plus;
    const iconColor = isRemocao ? 'text-red-500' : 'text-green-500';
    const bgColor = isRemocao ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20';
    const borderColor = isRemocao ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800';

    return (
      <div className={`flex items-start gap-3 p-2 rounded-lg border ${bgColor} ${borderColor}`}>
        <Icon className={`h-4 w-4 mt-0.5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {dados.descr || dados.codprod}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {dados.ref ? `Ref: ${dados.ref}` : `Cod: ${dados.codprod}`}
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-600 dark:text-gray-300">
            <span>Qtd: {dados.quantidade || 0}</span>
            <span>Unit: {formatCurrency(dados.preco_unitario || 0)}</span>
            <span className="font-medium">Total: {formatCurrency(dados.preco_total || 0)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Componente para item editado
  const EditedItemCard: React.FC<{ dados: any }> = ({ dados }) => {
    const alteracoes = dados.alteracoes || {};

    return (
      <div className="flex items-start gap-3 p-2 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <Edit3 className="h-4 w-4 mt-0.5 text-yellow-600" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {dados.descr || dados.codprod}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {dados.ref ? `Ref: ${dados.ref}` : `Cod: ${dados.codprod}`}
          </div>
          <div className="space-y-1 text-xs">
            {alteracoes.quantidade && (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <span>Quantidade:</span>
                <span className="line-through text-gray-400">{alteracoes.quantidade.anterior}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-blue-600 dark:text-blue-400">{alteracoes.quantidade.novo}</span>
              </div>
            )}
            {alteracoes.preco_unitario && (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <span>Preco Unit:</span>
                <span className="line-through text-gray-400">{formatCurrency(alteracoes.preco_unitario.anterior)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(alteracoes.preco_unitario.novo)}</span>
              </div>
            )}
            {alteracoes.observacao && (
              <div className="text-gray-600 dark:text-gray-300">
                Observacao alterada
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente para substituicao de item
  const SubstitutionCard: React.FC<{ dados: any }> = ({ dados }) => {
    const original = dados.original || {};
    const novo = dados.novo || {};

    return (
      <div className="space-y-2 p-2 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300">
          <RefreshCw className="h-4 w-4" />
          Substituicao de Item
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
            <div className="text-red-600 dark:text-red-400 font-medium mb-1">Item Original</div>
            <div className="text-gray-900 dark:text-gray-100 truncate">{original.descr || original.codprod}</div>
            <div className="text-gray-500">{original.ref ? `Ref: ${original.ref}` : `Cod: ${original.codprod}`}</div>
          </div>
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
            <div className="text-green-600 dark:text-green-400 font-medium mb-1">Novo Item</div>
            <div className="text-gray-900 dark:text-gray-100 truncate">{novo.descr || novo.codprod}</div>
            <div className="text-gray-500">{novo.ref ? `Ref: ${novo.ref}` : `Cod: ${novo.codprod}`}</div>
            {novo.quantidade && <div className="mt-1">Qtd: {novo.quantidade} | {formatCurrency(novo.preco_unitario || 0)}</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderComment = (comment: string | null) => {
    if (!comment) return null;

    const parsed = parseComentarioHistorico(comment);

    if (parsed && parsed.tipo && parsed.dados) {
      // Renderizacao especial baseada no tipo
      switch (parsed.tipo) {
        case 'ADICAO_ITENS_LOTE':
          return <ItemsAccordion dados={parsed.dados} />;

        case 'ADICAO_ITEM':
        case 'REMOCAO_ITEM':
          return <SingleItemCard dados={parsed.dados} tipo={parsed.tipo} />;

        case 'EDICAO_ITEM':
          return <EditedItemCard dados={parsed.dados} />;

        case 'SUBSTITUICAO_ITEM':
          return <SubstitutionCard dados={parsed.dados} />;

        default:
          // Fallback para markdown se tiver descricao_legivel
          if (parsed.descricao_legivel) {
            return (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                    li: ({ children }) => <li className="mb-1">{children}</li>
                  }}
                >
                  {parsed.descricao_legivel}
                </ReactMarkdown>
              </div>
            );
          }
      }
    }

    if (parsed && parsed.descricao_legivel) {
      // Render structured JSON comment with markdown
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
              li: ({ children }) => <li className="mb-1">{children}</li>
            }}
          >
            {parsed.descricao_legivel}
          </ReactMarkdown>
        </div>
      );
    } else {
      // Render plain text comment
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Histórico da Requisição
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {requisitionNumber || `Requisição #${requisitionId}`}
              {requisitionVersion && ` (v${requisitionVersion})`}
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
                <div className="text-red-500 text-sm mb-2">❌ {error}</div>
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
              <p className="text-sm">Esta requisição ainda não possui registros de mudança de status.</p>
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
                              <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(item.previous_status)}`}>
                                {item.status_label_anterior}
                              </span>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                              <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(item.new_status)}`}>
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
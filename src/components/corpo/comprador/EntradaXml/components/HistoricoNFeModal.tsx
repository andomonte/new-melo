/**
 * Modal de Historico de Entrada de NFe
 *
 * Exibe timeline de todas as acoes realizadas na NFe
 * Com diferenciacao visual por usuario
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, User, MessageSquare, ArrowRight, FileText, Upload, Package, DollarSign, Truck, CheckCircle, Play } from 'lucide-react';
import api from '@/components/services/api';
import { formatCurrency } from '../utils/formatters';

interface HistoricoNfeItem {
  id: number;
  tipoAcao: string;
  tipoAcaoLabel: string;
  statusAnterior: string | null;
  statusAnteriorLabel: string;
  statusNovo: string | null;
  statusNovoLabel: string;
  userId: string;
  userName: string;
  comments: string | null;
  createdAt: string;
}

interface NfeInfo {
  id: number;
  numeroNf: string;
  serie: string;
  chave: string;
  valorTotal: number;
  status: string;
  statusLabel: string;
  dataUpload: string;
  dataEmissao: string;
  emitente: string;
}

interface HistoricoNFeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfeId: number | string;
  nfeNumero?: string;
}

// Cores para diferenciar usuarios (paleta sutil)
const USER_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-500' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500' },
];

export const HistoricoNFeModal: React.FC<HistoricoNFeModalProps> = ({
  isOpen,
  onClose,
  nfeId,
  nfeNumero
}) => {
  const [historico, setHistorico] = useState<HistoricoNfeItem[]>([]);
  const [nfe, setNfe] = useState<NfeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapear usuarios para cores
  const userColorMap = useMemo(() => {
    const map = new Map<string, typeof USER_COLORS[0]>();
    const uniqueUsers = [...new Set(historico.map(h => h.userId))];
    uniqueUsers.forEach((userId, index) => {
      map.set(userId, USER_COLORS[index % USER_COLORS.length]);
    });
    return map;
  }, [historico]);

  // Identificar usuario iniciador
  const usuarioIniciador = useMemo(() => {
    const primeiroRegistro = historico.find(h =>
      h.tipoAcao === 'UPLOAD' || h.tipoAcao === 'INICIO_PROCESSAMENTO'
    );
    return primeiroRegistro?.userId || null;
  }, [historico]);

  useEffect(() => {
    if (isOpen && nfeId) {
      loadHistorico();
    }
  }, [isOpen, nfeId]);

  const loadHistorico = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/entrada-xml/nfe/${nfeId}/historico`);

      if (response.data.success) {
        setHistorico(response.data.historico || []);
        setNfe(response.data.nfe || null);
      } else {
        setError(response.data.erro || 'Erro ao carregar historico');
      }
    } catch (err: any) {
      console.error('Erro ao carregar historico:', err);
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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '':
      case null:
        return 'bg-gray-400';
      case 'R':
        return 'bg-blue-500';
      case 'A':
        return 'bg-yellow-500';
      case 'C':
        return 'bg-green-500';
      case 'S':
        return 'bg-emerald-600';
      case 'N':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getActionIcon = (tipoAcao: string) => {
    switch (tipoAcao) {
      case 'UPLOAD':
        return <Upload className="h-4 w-4" />;
      case 'INICIO_PROCESSAMENTO':
      case 'CONTINUAR_PROCESSAMENTO':
        return <Play className="h-4 w-4" />;
      case 'ASSOCIACAO_ITEM':
      case 'ASSOCIACAO_CONCLUIDA':
        return <Package className="h-4 w-4" />;
      case 'CONFIG_PAGAMENTO':
      case 'PAGAMENTO_ANTECIPADO':
        return <DollarSign className="h-4 w-4" />;
      case 'CTE_CADASTRADO':
        return <Truck className="h-4 w-4" />;
      case 'ENTRADA_GERADA':
      case 'PROCESSADA':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const parseComments = (comments: string | null) => {
    if (!comments) return null;
    try {
      return JSON.parse(comments);
    } catch {
      return { descricao: comments };
    }
  };

  const renderComment = (comments: string | null) => {
    const parsed = parseComments(comments);
    if (!parsed) return null;

    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {parsed.descricao && <p>{parsed.descricao}</p>}
        {parsed.numeroNf && <p>NFe: {parsed.numeroNf}</p>}
        {parsed.emitente && <p>Emitente: {parsed.emitente}</p>}
        {parsed.valorTotal && <p>Valor: {formatCurrency(parsed.valorTotal)}</p>}
        {parsed.itemNfe && <p>Item: {parsed.itemNfe}</p>}
        {parsed.produtoAssociado && <p>Produto: {parsed.produtoAssociado}</p>}
        {parsed.ordemCompra && <p>OC: {parsed.ordemCompra}</p>}
        {parsed.parcelas && <p>Parcelas: {parsed.parcelas}</p>}
        {parsed.banco && <p>Banco: {parsed.banco}</p>}
        {parsed.numeroCte && <p>CT-e: {parsed.numeroCte}</p>}
        {parsed.transportadora && <p>Transportadora: {parsed.transportadora}</p>}
        {parsed.valorFrete && <p>Valor Frete: {formatCurrency(parsed.valorFrete)}</p>}
      </div>
    );
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
              Historico da NFe
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {nfeNumero || nfe?.numeroNf || `NFe #${nfeId}`}
              {nfe && (
                <span className="ml-2">
                  - {nfe.emitente}
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    ({formatCurrency(nfe.valorTotal)})
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

        {/* Legenda de usuarios */}
        {historico.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-700/50 border-b border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Usuarios:</span>
              {[...userColorMap.entries()].map(([userId, colors]) => {
                const userName = historico.find(h => h.userId === userId)?.userName || userId;
                const isIniciador = userId === usuarioIniciador;
                return (
                  <div key={userId} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {userName}
                      {isIniciador && (
                        <span className="ml-1 text-blue-600 dark:text-blue-400 font-medium">(iniciador)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando historico...</span>
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
              <p className="text-lg font-medium">Nenhum historico encontrado</p>
              <p className="text-sm">Esta NFe ainda nao possui registros de alteracao.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[55vh]">
              <div className="space-y-4">
                {historico.map((item, index) => {
                  const userColors = userColorMap.get(item.userId) || USER_COLORS[0];
                  const isIniciador = item.userId === usuarioIniciador;

                  return (
                    <div key={item.id} className="relative">
                      {/* Timeline line */}
                      {index < historico.length - 1 && (
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>
                      )}

                      {/* Timeline item */}
                      <div className="flex items-start space-x-4">
                        {/* Timeline dot */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-zinc-700 border-2 ${userColors.border} flex items-center justify-center`}>
                          <div className={`${userColors.dot} text-white p-2 rounded-full`}>
                            {getActionIcon(item.tipoAcao)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className={`flex-1 ${userColors.bg} border ${userColors.border} rounded-lg p-4`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              {/* Tipo de acao */}
                              <span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded">
                                {item.tipoAcaoLabel}
                              </span>

                              {/* Status transition - so mostra se houve mudanca real de status */}
                              {(item.statusAnterior || item.statusNovo) && item.statusAnterior !== item.statusNovo && (
                                <div className="flex items-center space-x-2">
                                  {item.statusAnteriorLabel && (
                                    <span
                                      className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(item.statusAnterior)}`}
                                    >
                                      {item.statusAnteriorLabel}
                                    </span>
                                  )}
                                  {item.statusAnterior && item.statusNovo && (
                                    <ArrowRight className="h-4 w-4 text-gray-400" />
                                  )}
                                  {item.statusNovoLabel && (
                                    <span
                                      className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(item.statusNovo)}`}
                                    >
                                      {item.statusNovoLabel}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>

                          {/* User info */}
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${userColors.dot}`}></div>
                            <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {item.userName}
                            </span>
                            {isIniciador && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                iniciador
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({item.userId})
                            </span>
                          </div>

                          {/* Comments */}
                          {item.comments && (
                            <div className="flex items-start space-x-2">
                              <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="mt-1 bg-white dark:bg-zinc-600 p-3 rounded border border-gray-200 dark:border-gray-500">
                                  {renderComment(item.comments)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

export default HistoricoNFeModal;

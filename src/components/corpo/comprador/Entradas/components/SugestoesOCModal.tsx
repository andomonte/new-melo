import React, { useState } from 'react';
import {
  X,
  Lightbulb,
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SugestaoOC } from '../hooks/useSugestoesOC';

interface SugestoesOCModalProps {
  isOpen: boolean;
  sugestoes: SugestaoOC[];
  totalOCsAnalisadas: number;
  criteriosUtilizados: string[];
  onClose: () => void;
  onSelecionarSugestao: (sugestao: SugestaoOC) => void;
}

export const SugestoesOCModal: React.FC<SugestoesOCModalProps> = ({
  isOpen,
  sugestoes,
  totalOCsAnalisadas,
  criteriosUtilizados,
  onClose,
  onSelecionarSugestao
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return dateString ? new Date(dateString).toLocaleDateString('pt-BR') : '-';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: 'Excelente', icon: '🎯' };
    if (score >= 60) return { label: 'Bom', icon: '👍' };
    if (score >= 40) return { label: 'Regular', icon: '⚠️' };
    return { label: 'Baixo', icon: '❌' };
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="text-[#347AB6]" size={24} />
              Sugestões Inteligentes de Ordens de Compra
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {sugestoes.length} sugestões de {totalOCsAnalisadas} OCs analisadas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Critérios de análise */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Critérios de Análise
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {criteriosUtilizados.join(' • ')}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de sugestões */}
          {sugestoes.length === 0 ? (
            <div className="text-center py-12">
              <XCircle className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma sugestão encontrada para esta NFe
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sugestoes.map((sugestao, index) => {
                const isExpanded = expandedId === sugestao.orc_id;
                const scoreBadge = getScoreBadge(sugestao.score_total);

                return (
                  <div
                    key={sugestao.orc_id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg hover:border-[#347AB6] dark:hover:border-[#347AB6] transition-colors"
                  >
                    {/* Cabeçalho da sugestão */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Info básica */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-bold text-gray-400 dark:text-gray-600">
                              #{index + 1}
                            </span>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              OC {sugestao.req_id_composto}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(sugestao.score_total)}`}>
                              {scoreBadge.icon} {sugestao.score_total} pts - {scoreBadge.label}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {sugestao.fornecedor_nome}
                          </p>

                          {/* Métricas resumidas */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded">
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <Package size={14} />
                                Produtos
                              </div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {sugestao.produtos_comum} de {sugestao.produtos_total_nfe}
                                <span className="text-xs text-gray-500 ml-1">
                                  ({sugestao.percentual_match_produtos.toFixed(0)}%)
                                </span>
                              </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded">
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <TrendingUp size={14} />
                                Quantidade
                              </div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {sugestao.similaridade_quantidade.toFixed(0)}% similar
                              </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded">
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <Calendar size={14} />
                                Data
                              </div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {sugestao.dias_diferenca} {sugestao.dias_diferenca === 1 ? 'dia' : 'dias'}
                              </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded">
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <DollarSign size={14} />
                                Valor Total
                              </div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(sugestao.valor_total)}
                              </p>
                            </div>
                          </div>

                          {/* Alertas */}
                          {sugestao.alertas.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={16} />
                                <div className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
                                  {sugestao.alertas.slice(0, isExpanded ? undefined : 2).map((alerta, idx) => (
                                    <p key={idx}>• {alerta}</p>
                                  ))}
                                  {!isExpanded && sugestao.alertas.length > 2 && (
                                    <p className="text-yellow-600 dark:text-yellow-400">
                                      + {sugestao.alertas.length - 2} mais alertas
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => onSelecionarSugestao(sugestao)}
                            className="bg-[#347AB6] hover:bg-[#2a6296] text-white whitespace-nowrap"
                          >
                            <CheckCircle2 size={16} className="mr-1" />
                            Usar Esta OC
                          </Button>
                          <Button
                            onClick={() => toggleExpand(sugestao.orc_id)}
                            variant="outline"
                            className="whitespace-nowrap"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={16} className="mr-1" />
                                Menos Detalhes
                              </>
                            ) : (
                              <>
                                <ChevronDown size={16} className="mr-1" />
                                Mais Detalhes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-slate-700/50">
                        {/* Scores detalhados */}
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Análise Detalhada dos Scores
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Fornecedor</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {sugestao.score_fornecedor}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Produtos</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {sugestao.score_produtos}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {sugestao.score_quantidade}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Data</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {sugestao.score_data}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Itens com match */}
                        {sugestao.itens_match.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                              Produtos em Comum ({sugestao.itens_match.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {sugestao.itens_match.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white dark:bg-slate-800 p-3 rounded border border-gray-200 dark:border-gray-600"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {item.codprod} - {item.descricao}
                                      </p>
                                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Qtd NFe:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {item.quantidade_nfe}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Qtd Disp.:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {item.quantidade_disponivel}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Dif.:</span>
                                          <span
                                            className={`ml-1 font-medium ${
                                              item.diferenca_quantidade_percentual > 50
                                                ? 'text-red-600 dark:text-red-400'
                                                : item.diferenca_quantidade_percentual > 20
                                                ? 'text-yellow-600 dark:text-yellow-400'
                                                : 'text-green-600 dark:text-green-400'
                                            }`}
                                          >
                                            {item.diferenca_quantidade_percentual.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Preço NFe:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(item.valor_unitario_nfe)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Preço OC:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(item.valor_unitario_oc)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Dif.:</span>
                                          <span
                                            className={`ml-1 font-medium ${
                                              item.diferenca_preco_percentual > 20
                                                ? 'text-red-600 dark:text-red-400'
                                                : item.diferenca_preco_percentual > 10
                                                ? 'text-yellow-600 dark:text-yellow-400'
                                                : 'text-green-600 dark:text-green-400'
                                            }`}
                                          >
                                            {item.diferenca_preco_percentual.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};

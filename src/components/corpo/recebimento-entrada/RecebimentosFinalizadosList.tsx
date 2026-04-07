/**
 * Lista de recebimentos finalizados (historico)
 */

import React from 'react';
import { RecebimentoFinalizado } from '@/data/recebimento-entrada/recebimentoEntradaService';
import {
  CheckCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface RecebimentosFinalizadosListProps {
  recebimentos: RecebimentoFinalizado[];
  isLoading: boolean;
  onRefresh: () => void;
  formatCurrency: (value: number) => string;
}

const RecebimentosFinalizadosList: React.FC<RecebimentosFinalizadosListProps> = ({
  recebimentos,
  isLoading,
  onRefresh,
  formatCurrency,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Recebimentos Finalizados
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg animate-pulse"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24 mb-2"></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recebimentos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum recebimento finalizado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recebimentos.map(rec => (
            <div
              key={rec.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  rec.tem_divergencia
                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  {rec.tem_divergencia ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {rec.numero_entrada}
                    </span>
                    {rec.tem_divergencia && (
                      <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                        Divergencia
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {rec.fornecedor} | {rec.qtd_itens} itens
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(rec.valor_total)}
                  </p>
                  {rec.tempo_recebimento && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {rec.tempo_recebimento}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(rec.data_recebimento)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecebimentosFinalizadosList;

/**
 * Lista de alocacoes finalizadas (historico)
 */

import React from 'react';
import { AlocacaoFinalizada } from '@/data/alocacao/alocacaoService';
import { CheckCircle, RefreshCw, Clock, Package, Warehouse } from 'lucide-react';

interface AlocacoesFinalizadasListProps {
  alocacoes: AlocacaoFinalizada[];
  isLoading: boolean;
  onRefresh: () => void;
  formatCurrency: (value: number) => string;
}

const AlocacoesFinalizadasList: React.FC<AlocacoesFinalizadasListProps> = ({
  alocacoes,
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
            Alocacoes Finalizadas
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
      ) : alocacoes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma alocacao finalizada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alocacoes.map(aloc => (
            <div
              key={aloc.id}
              className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
            >
              {/* Linha 1: Icone + Numero + Valor */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                    <Warehouse className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {aloc.numero_entrada}
                  </span>
                  {aloc.arm_descricao && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded flex-shrink-0">
                      {aloc.arm_descricao}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  {formatCurrency(aloc.valor_total)}
                </span>
              </div>

              {/* Linha 2: Fornecedor + Tempo + Data */}
              <div className="flex items-center justify-between mt-1 ml-9">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
                  {aloc.fornecedor}
                  {aloc.tempo_alocacao && (
                    <span className="ml-2 inline-flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {aloc.tempo_alocacao}
                    </span>
                  )}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                  {formatDate(aloc.data_alocacao)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlocacoesFinalizadasList;

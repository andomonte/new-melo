import React from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { ConferenciaFinalizada } from '@/data/conferencia/conferenciaService';

interface ConferenciasFinalizadasListProps {
  conferenciasFinalizadas: ConferenciaFinalizada[];
  isLoading: boolean;
}

/**
 * Componente para exibir lista de conferências finalizadas
 *
 * Mostra um histórico das últimas conferências concluídas pelo conferente do dia atual,
 * com informações de tempo de conferência e dados do pedido.
 */
const ConferenciasFinalizadasList: React.FC<
  ConferenciasFinalizadasListProps
> = ({ conferenciasFinalizadas, isLoading }) => {
  /**
   * Formata valor monetário para exibição
   */
  const formatarMoeda = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  /**
   * Formata data para exibição
   */
  const formatarData = (dataStr: string): string => {
    try {
      const data = new Date(dataStr);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Data inválida';
    }
  };

  /**
   * Formata timestamp de finalização
   */
  const formatarFinalizacao = (finalizadoStr: string): string => {
    try {
      const data = new Date(finalizadoStr);
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Data inválida';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-3">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Conferências Finalizadas Recentes
          </h3>
        </div>

        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg animate-pulse"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24 mb-2"></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-16 mb-2"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conferenciasFinalizadas.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Conferências Finalizadas Recentes
          </h3>
        </div>

        <div className="text-center py-4">
          <CheckCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Nenhuma conferência finalizada recentemente.
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            As conferências finalizadas nos últimos 7 dias aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-3">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Conferências Finalizadas Recentes
        </h3>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {conferenciasFinalizadas.map((conferencia) => (
          <div
            key={conferencia.codvenda}
            className="flex items-center p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
          >
            {/* Ícone e informações principais */}
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    #{conferencia.codvenda}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    •
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {conferencia.nomeCliente}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <span>{formatarMoeda(conferencia.total)}</span>
                  </div>

                  {conferencia.tempoDeConferencia && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Tempo: {conferencia.tempoDeConferencia}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Informações de tempo */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <div className="text-right text-sm">
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                  <span>{formatarData(conferencia.data)}</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  Finalizado:{' '}
                  {formatarFinalizacao(conferencia.finalizadopedido)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer com informações adicionais */}
      {conferenciasFinalizadas.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Mostrando as {conferenciasFinalizadas.length} conferências mais
              recentes do dia atual
            </span>
            <span>
              Última atualização:{' '}
              {new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferenciasFinalizadasList;

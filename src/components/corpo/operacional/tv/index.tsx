import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PedidoTV,
  getPedidosParaTVPaginado,
  ContagensPedidos,
  getContagensPedidos,
} from '@/data/pedidos/pedidosService';
import { RefreshCw } from 'lucide-react';

const TelaTVPage = () => {
  const [pedidos, setPedidos] = useState<PedidoTV[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false); // Flag para evitar problemas de hidratação
  const [contagens, setContagens] = useState<ContagensPedidos>({
    aguardando: 0,
    emSeparacao: 0,
    separados: 0,
    emConferencia: 0,
    total: 0,
  });

  // Função para calcular tempo decorrido em minutos
  const calcularTempoDecorrido = (inicioSeparacao: string | null): number => {
    if (!inicioSeparacao || !isClient) return 0; // Só calcula no cliente
    const inicio = new Date(inicioSeparacao);
    const agora = new Date();
    const diffMs = agora.getTime() - inicio.getTime();
    return Math.floor(diffMs / (1000 * 60)); // Converter para minutos
  };

  // Função para formatar o cronômetro
  const formatarCronometro = (pedido: PedidoTV): string => {
    // Mostra cronômetro para todos os status exceto "Aguardando"
    if (
      pedido.status === 'Aguardando' ||
      !pedido.inicioseparacao ||
      !isClient
    ) {
      return '-';
    }

    const tempoDecorrido = calcularTempoDecorrido(pedido.inicioseparacao);
    const previsao = pedido.previsao;
    const tempoRestante = previsao - tempoDecorrido;

    // Formatar tempo em horas e minutos se necessário
    const formatarTempo = (minutos: number): string => {
      const minutosAbs = Math.abs(minutos);
      if (minutosAbs < 60) {
        return `${minutos}min`;
      } else {
        const horas = Math.floor(minutosAbs / 60);
        const minutosRestantes = minutosAbs % 60;
        const sinal = minutos < 0 ? '-' : '';
        return `${sinal}${horas}h${
          minutosRestantes > 0 ? `${minutosRestantes}min` : ''
        }`;
      }
    };

    return formatarTempo(tempoRestante);
  };

  // Atualizar relógio a cada segundo
  useEffect(() => {
    setIsClient(true); // Marca que estamos no cliente
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar dados - Otimizado com useCallback
  const loadData = useCallback(
    async (showFullLoading = false) => {
      try {
        // Se já temos dados, não mostrar loading (atualização silenciosa)
        // Só mostra loading na primeira carga
        if (pedidos.length === 0 && showFullLoading) {
          setLoading(true);
        } else {
          setIsUpdating(true);
        }

        // Buscar pedidos e contagens em paralelo
        const [pedidosResponse, contagensResponse] = await Promise.all([
          getPedidosParaTVPaginado({
            page: 1,
            perPage: 100, // Carregar 100 pedidos para visualização
            search: '',
            filtros: [],
          }),
          getContagensPedidos(), // Buscar contagens reais de todos os pedidos
        ]);

        // Atualizar os dados sempre, mesmo se houve erro
        if (pedidosResponse.data) {
          setPedidos(pedidosResponse.data);
        }

        if (contagensResponse) {
          setContagens(contagensResponse);
        }
      } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        // Em caso de erro, manter os dados existentes visíveis
        // Não limpar os pedidos se já existem dados
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    },
    [pedidos.length],
  ); // Dependências do useCallback

  // Carregar dados inicialmente e a cada 30 segundos
  useEffect(() => {
    const loadInitialData = async () => {
      await loadData(true); // Primeira carga com loading
    };

    loadInitialData();

    const interval = setInterval(() => {
      loadData(false); // Atualizações automáticas silenciosas
    }, 10000); // Auto-refresh a cada 10s

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Otimização: Memoizar pedidos ordenados para evitar re-ordenação desnecessária
  const pedidosOrdenados = useMemo(() => {
    return pedidos.sort(
      (a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime(),
    );
  }, [pedidos]);

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header Compacto */}
      <div className="flex justify-between items-center py-2 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Monitor de Pedidos (TV)
          </h1>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Acompanhamento em Tempo Real
          </span>
          {isUpdating && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Atualizando...
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div
              className="text-lg font-mono font-bold text-gray-900 dark:text-white"
              suppressHydrationWarning
            >
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
            <div
              className="text-xs text-gray-600 dark:text-gray-400"
              suppressHydrationWarning
            >
              {currentTime.toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </div>
          </div>
          <button
            onClick={() => loadData(false)}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors disabled:opacity-50"
            disabled={isUpdating}
          >
            <RefreshCw
              className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`}
            />
            <span>{isUpdating ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* Estatísticas Compactas - Removido card "Conferidos" conforme solicitado */}
      {(pedidos.length > 0 || contagens.total > 0) && (
        <div
          className={`grid grid-cols-4 gap-2 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 transition-opacity duration-200 ${
            isUpdating ? 'opacity-90' : 'opacity-100'
          }`}
        >
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2 text-center">
            <div className="text-lg font-bold text-yellow-800 dark:text-yellow-400">
              {contagens.aguardando}
            </div>
            <div className="text-xs text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
              Aguardando
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-800 dark:text-blue-400">
              {contagens.emSeparacao}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Em Separação
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2 text-center">
            <div className="text-lg font-bold text-green-800 dark:text-green-400">
              {contagens.separados}
            </div>
            <div className="text-xs text-green-700 dark:text-green-400 uppercase tracking-wide">
              Separados
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-3 py-2 text-center">
            <div className="text-lg font-bold text-orange-800 dark:text-orange-400">
              {contagens.emConferencia}
            </div>
            <div className="text-xs text-orange-700 dark:text-orange-400 uppercase tracking-wide">
              Em Conferência
            </div>
          </div>
        </div>
      )}

      {/* Tabela - Ocupa todo o espaço restante */}
      <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden">
        {loading && pedidos.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
              Carregando...
            </span>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Nr. Venda
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Horário
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Previsão
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Cronômetro
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Responsável
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {pedidosOrdenados.map((pedido, index) => (
                  <tr
                    key={pedido.NrVenda}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-gray-50/50 dark:bg-gray-800/50'
                    } ${isUpdating ? 'opacity-90' : 'opacity-100'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-base font-mono font-bold text-blue-600 dark:text-blue-400">
                        {pedido.NrVenda}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block">
                          {pedido.Cliente}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="text-sm font-mono text-gray-600 dark:text-gray-400"
                        suppressHydrationWarning
                      >
                        {new Date(pedido.horario).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          pedido.status === 'Aguardando'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : pedido.status === 'Em Separação'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : pedido.status === 'Separado'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : pedido.status === 'Em Conferência' ||
                              pedido.status === 'Conferência'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            : pedido.status === 'Conferido'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}
                      >
                        {pedido.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {pedido.status === 'Em Separação' ||
                      pedido.status === 'Separado' ||
                      pedido.status === 'Em Conferência' ? (
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {pedido.previsao} min
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {pedido.status !== 'Aguardando' &&
                      pedido.inicioseparacao &&
                      isClient ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            calcularTempoDecorrido(pedido.inicioseparacao) >
                            pedido.previsao
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}
                          suppressHydrationWarning
                        >
                          {formatarCronometro(pedido)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {pedido.responsavel || 'Não atribuído'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mensagem quando não há pedidos */}
            {pedidosOrdenados.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="text-4xl text-gray-400 mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Nenhum pedido encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-500">
                  Todos os pedidos foram processados
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TelaTVPage;

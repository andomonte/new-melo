import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import FilialGate from '@/components/common/FilialGate';
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

  // Filial (tela solta, sem login — destravada pelo código da filial)
  const [filial, setFilial] = useState('MANAUS');
  const filialRef = useRef('MANAUS');
  const [locked, setLocked] = useState(true);

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

  // Se a filial já foi destravada nesta sessão, não re-pede o código no reload.
  useEffect(() => {
    try {
      const f = sessionStorage.getItem('gate_tv_filial');
      if (f) { setFilial(f); filialRef.current = f; setLocked(false); }
    } catch { /* ignore */ }
  }, []);

  const onUnlockFilial = (f: string) => {
    setFilial(f); filialRef.current = f;
    try { sessionStorage.setItem('gate_tv_filial', f); } catch { /* ignore */ }
    setLocked(false);
  };
  const trocarFilial = () => {
    try { sessionStorage.removeItem('gate_tv_filial'); } catch { /* ignore */ }
    setLocked(true);
  };

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
            filial: filialRef.current,
          }),
          getContagensPedidos(filialRef.current), // contagens da filial selecionada
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


  // Carregar dados quando destravado; pausa enquanto o gate de filial está ativo
  useEffect(() => {
    if (locked) return;
    loadData(true); // Primeira carga com loading

    const interval = setInterval(() => {
      loadData(false); // Atualizações automáticas silenciosas
    }, 10000); // Auto-refresh a cada 10s

    return () => clearInterval(interval);
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Otimização: Memoizar pedidos ordenados para evitar re-ordenação desnecessária
  const pedidosOrdenados = useMemo(() => {
    return pedidos.sort(
      (a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime(),
    );
  }, [pedidos]);

  return (
    <div className="tv-monitor w-full h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500&family=Oswald:wght@400;500&display=swap"
        />
      </Head>
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

        <div className="tv-counts">
          <span className="tvc c-aguard"><b>{contagens.aguardando}</b> Aguardando</span>
          <span className="tvc c-sep"><b>{contagens.emSeparacao}</b> Em Separação</span>
          <span className="tvc c-separ"><b>{contagens.separados}</b> Separados</span>
          <span className="tvc c-conf"><b>{contagens.emConferencia}</b> Em Conferência</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-semibold">
              {filial}
            </span>
            <button
              onClick={trocarFilial}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:border-blue-500"
              title="Trocar filial (pede o código)"
            >
              Trocar filial
            </button>
          </div>
          <div className="text-right">
            <div
              className="tv-relogio text-lg font-mono font-bold text-gray-900 dark:text-white"
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
                          className={`px-2 py-1 rounded-full text-xs font-semibold font-mono ${
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

      <style jsx global>{`
        .tv-monitor {
          /* Densidade do painel: quantas linhas cabem na área da tabela.
             8 = TV menor (linhas maiores) · 12 = TV maior (mais linhas). */
          --linhas: 10;
          --altura-cabecalho: 12vh;
          --altura-linha: calc((100vh - var(--altura-cabecalho)) / var(--linhas));
          --fonte-linha: calc(var(--altura-linha) * 0.42);
          font-family: 'Barlow Semi Condensed', 'Arial Narrow', system-ui, sans-serif;
        }
        /* Números em Oswald + tabular-nums (nr venda, horário, cronômetro,
           relógio e contagens) — largura estável, sem "pulo". */
        .tv-monitor .font-mono,
        .tv-monitor .tv-relogio,
        .tv-monitor .tvc b {
          font-family: 'Oswald', 'Barlow Semi Condensed', sans-serif;
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum';
        }
        /* Tabela escalada por altura de viewport */
        .tv-monitor table { table-layout: fixed; width: 100%; }
        .tv-monitor thead th {
          font-size: calc(var(--fonte-linha) * 0.55);
          letter-spacing: 0.08em;
          font-weight: 500;
        }
        .tv-monitor tbody tr { height: var(--altura-linha); }
        .tv-monitor tbody td {
          font-size: var(--fonte-linha);
          font-weight: 500;
          line-height: 1.1;
          padding-top: 0;
          padding-bottom: 0;
          vertical-align: middle;
        }
        .tv-monitor tbody td span { font-size: inherit; font-weight: 500; line-height: 1.1; }
        /* Larguras das colunas — Cliente é a mais larga (nomes longos) */
        .tv-monitor th:nth-child(1) { width: 12%; }
        .tv-monitor th:nth-child(2) { width: 30%; }
        .tv-monitor th:nth-child(3) { width: 12%; }
        .tv-monitor th:nth-child(4) { width: 13%; }
        .tv-monitor th:nth-child(5) { width: 9%; }
        .tv-monitor th:nth-child(6) { width: 10%; }
        .tv-monitor th:nth-child(7) { width: 14%; }
        /* Cliente: ocupa a coluna toda e trunca com "..." */
        .tv-monitor tbody td > div { max-width: none; }
        .tv-monitor tbody td .truncate {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /* Badges (status/cronômetro) acompanham a fonte — cores intactas */
        .tv-monitor tbody td .rounded-full {
          font-size: calc(var(--fonte-linha) * 0.6);
          font-weight: 500;
          padding: 0.15em 0.7em;
        }
        /* Contagens por status no cabeçalho (substituem os cards) */
        .tv-monitor .tv-counts { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .tv-monitor .tvc {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 10px; border: 1px solid transparent;
          font-size: 1.9vh; font-weight: 500; letter-spacing: 0.02em; white-space: nowrap;
        }
        .tv-monitor .tvc b { font-size: 3.4vh; font-weight: 500; line-height: 1; }
        .tv-monitor .c-aguard { background: #fef9e7; color: #8a6d1a; border-color: #f2e2a8; }
        .tv-monitor .c-sep    { background: #e8f1fb; color: #1e5aa0; border-color: #bcd6f2; }
        .tv-monitor .c-separ  { background: #e7f5ec; color: #1c7a43; border-color: #b6e0c4; }
        .tv-monitor .c-conf   { background: #fdf0e5; color: #a85d1a; border-color: #f3d3b0; }
        .dark .tv-monitor .c-aguard { background: rgba(202,138,4,.15);  color: #e6c65b; border-color: rgba(202,138,4,.35); }
        .dark .tv-monitor .c-sep    { background: rgba(37,99,175,.15);  color: #7ab0e6; border-color: rgba(37,99,175,.35); }
        .dark .tv-monitor .c-separ  { background: rgba(28,122,67,.15);  color: #5cc48a; border-color: rgba(28,122,67,.35); }
        .dark .tv-monitor .c-conf   { background: rgba(168,93,26,.15);  color: #e0a45b; border-color: rgba(168,93,26,.35); }
        /* Relógio */
        .tv-monitor .tv-relogio { font-size: 6vh; font-weight: 500; line-height: 1; }
      `}</style>

      {locked && (
        <FilialGate
          filiaisUrl="/api/pedidos/tv/filiais"
          initialFilial={filial}
          titulo="Monitor de Pedidos (TV)"
          onUnlock={onUnlockFilial}
        />
      )}
    </div>
  );
};

export default TelaTVPage;

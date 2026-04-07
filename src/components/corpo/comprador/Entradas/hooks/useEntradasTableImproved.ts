import { useState, useEffect, useCallback } from 'react';
import { colunasDbEntrada, colunasIniciaisEntrada } from '../colunasDbEntrada';

interface UseEntradasTableImprovedProps {
  colunasIniciais?: string[];
  limiteColunas?: number; // Padrão: 9 colunas (não persistido)
  storageKey?: string;
}

interface FiltroAvancado {
  campo: string;
  tipo: string;
  valor: string;
}

export const useEntradasTableImproved = ({
  colunasIniciais = colunasIniciaisEntrada,
  limiteColunas = 9,
  storageKey = 'entradas-table-config-v7', // v7: status na ultima coluna
}: UseEntradasTableImprovedProps = {}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<FiltroAvancado[]>([]);
  const [limiteColunasState, setLimiteColunas] = useState(limiteColunas);

  // Filtros avancados especificos
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroTipoEntrada, setFiltroTipoEntrada] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>('');

  // Estados para filtros rapidos (por coluna)
  const [mostrarFiltrosRapidos, setMostrarFiltrosRapidos] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, { tipo: string; valor: string }>>({});

  // Inicializar headers com configuracao salva ou padrao
  // NOTA: limiteColunas NAO é restaurado do localStorage (sempre usa o padrao de 6)
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(storageKey);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        let savedHeaders = config.headers || [];

        // Garantir que nao ha duplicatas e que acoes esta na primeira posicao
        savedHeaders = savedHeaders.filter((h: string) => h !== 'acoes');
        savedHeaders = ['acoes', ...savedHeaders];

        // Remover duplicatas
        savedHeaders = [...new Set(savedHeaders)];

        // Limitar headers ao limite padrao (6 colunas)
        if (savedHeaders.length > limiteColunas) {
          savedHeaders = savedHeaders.slice(0, limiteColunas);
        }

        setHeaders(savedHeaders.length > 1 ? savedHeaders : getDefaultHeaders());
        // NAO restaurar limiteColunas - sempre usar o padrao
      } else {
        setHeaders(getDefaultHeaders());
      }
    } catch (error) {
      console.error('Erro ao carregar configuracao da tabela:', error);
      setHeaders(getDefaultHeaders());
    }
  }, [storageKey, limiteColunas]);

  // Salvar configuracao no localStorage
  // NOTA: limiteColunas NAO é salvo (sempre reseta ao padrao de 6 ao recarregar)
  const salvarConfiguracao = useCallback(
    (newHeaders: string[]) => {
      try {
        const config = {
          headers: newHeaders,
          // limiteColunas NAO é salvo propositalmente
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch (error) {
        console.error('Erro ao salvar configuracao da tabela:', error);
      }
    },
    [storageKey]
  );

  // Obter headers padrao
  const getDefaultHeaders = useCallback(() => {
    if (colunasIniciais) {
      return colunasIniciais;
    }

    // Iniciar com acoes na primeira posicao
    const headersPadrao = ['acoes'];

    // Adicionar colunas fixas (exceto acoes)
    const colunasFixas = colunasDbEntrada
      .filter(col => col.fixo && col.campo !== 'acoes')
      .map(col => col.campo);

    headersPadrao.push(...colunasFixas);

    // Adicionar colunas opcionais ate o limite
    const colunasOpcionais = colunasDbEntrada
      .filter(col => !col.fixo)
      .map(col => col.campo);

    const espacoRestante = limiteColunas - headersPadrao.length;
    headersPadrao.push(...colunasOpcionais.slice(0, espacoRestante));

    return headersPadrao;
  }, [colunasIniciais, limiteColunas]);

  // Atualizar limite de colunas
  const handleLimiteColunasChange = useCallback(
    (novoLimite: number) => {
      setLimiteColunas(novoLimite);

      const colunasFixas = colunasDbEntrada
        .filter(col => col.fixo && col.campo !== 'acoes')
        .map(col => col.campo);

      const colunasOpcionais = colunasDbEntrada.filter(col => !col.fixo).map(col => col.campo);

      // Headers atuais (removendo as fixas e acoes)
      const headersAtuaisOpcionais = headers.filter(
        h => !colunasFixas.includes(h) && h !== 'acoes'
      );

      // Calcular quantas colunas opcionais podemos ter com o novo limite
      const limiteOpcionais = novoLimite - colunasFixas.length - 1;

      // Se temos mais headers que o limite, manter os primeiros
      let novosHeadersOpcionais = headersAtuaisOpcionais.slice(0, limiteOpcionais);

      // Se precisamos de mais headers, adicionar dos disponiveis
      if (novosHeadersOpcionais.length < limiteOpcionais) {
        const headersParaAdicionar = colunasOpcionais
          .filter(col => !novosHeadersOpcionais.includes(col))
          .slice(0, limiteOpcionais - novosHeadersOpcionais.length);
        novosHeadersOpcionais = [...novosHeadersOpcionais, ...headersParaAdicionar];
      }

      // Combinar: acoes na primeira posicao + colunas opcionais + colunas fixas
      const novosHeaders = ['acoes', ...novosHeadersOpcionais, ...colunasFixas];

      setHeaders(novosHeaders);
      salvarConfiguracao(novosHeaders);
    },
    [headers, salvarConfiguracao]
  );

  // Substituir coluna
  const handleColunaSubstituida = useCallback(
    (colunaA: string, colunaB: string, tipo: 'swap' | 'replace' = 'replace') => {
      setHeaders(prevHeaders => {
        const novosHeaders = [...prevHeaders];

        if (tipo === 'swap') {
          const indexA = novosHeaders.indexOf(colunaA);
          const indexB = novosHeaders.indexOf(colunaB);

          if (indexA !== -1 && indexB !== -1) {
            [novosHeaders[indexA], novosHeaders[indexB]] = [
              novosHeaders[indexB],
              novosHeaders[indexA],
            ];
          }
        } else {
          const index = novosHeaders.indexOf(colunaA);
          if (index !== -1) {
            novosHeaders[index] = colunaB;
          }
        }

        salvarConfiguracao(novosHeaders);
        return novosHeaders;
      });
    },
    [limiteColunasState, salvarConfiguracao]
  );

  // Handlers para busca
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
    }
  }, []);

  const handleSearchBlur = useCallback(() => {
    setPage(1);
  }, []);

  // Handlers para paginacao
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  }, []);

  // Handlers para selecao
  const handleRowSelect = useCallback((selected: boolean, rowData: { id?: string | number }) => {
    const rowId = rowData.id?.toString() || '';

    setSelectedRows(prev => {
      if (selected) {
        return [...prev, rowId];
      } else {
        return prev.filter(id => id !== rowId);
      }
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean, allRows: { id?: string | number }[]) => {
    if (selected && allRows) {
      const allIds = allRows.map(row => row.id?.toString() || '').filter(Boolean);
      setSelectedRows(allIds);
    } else {
      setSelectedRows([]);
    }
  }, []);

  // Handler para filtros genericos
  const handleFiltroChange = useCallback((novosFiltros: FiltroAvancado[]) => {
    setFiltros(novosFiltros);
    setPage(1);
  }, []);

  // Aplicar filtros avancados
  const aplicarFiltrosAvancados = useCallback(
    (filtrosAvancados: {
      status?: string;
      tipoEntrada?: string;
      dataInicio?: string;
      dataFim?: string;
      fornecedor?: string;
    }) => {
      setFiltroStatus(filtrosAvancados.status || '');
      setFiltroTipoEntrada(filtrosAvancados.tipoEntrada || '');
      setFiltroDataInicio(filtrosAvancados.dataInicio || '');
      setFiltroDataFim(filtrosAvancados.dataFim || '');
      setFiltroFornecedor(filtrosAvancados.fornecedor || '');
      setPage(1);
    },
    []
  );

  // Handler para alterar valor de filtro rapido em uma coluna
  const handleFiltroRapidoChange = useCallback((header: string, valor: string) => {
    setFiltrosColuna(prev => ({
      ...prev,
      [header]: { tipo: prev[header]?.tipo || 'contém', valor },
    }));
    // Limpar busca global quando usar filtro de coluna
    if (search !== '') {
      setSearch('');
    }
  }, [search]);

  // Toggle filtros rapidos
  const handleToggleFiltrosRapidos = useCallback(() => {
    setMostrarFiltrosRapidos(prev => {
      const novoEstado = !prev;
      if (!novoEstado) {
        // Limpar filtros ao ocultar
        setFiltrosColuna({});
        setFiltros([]);
      }
      return novoEstado;
    });
  }, []);

  // Aplicar filtros rapidos (ao pressionar Enter ou blur)
  const aplicarFiltrosRapidos = useCallback(() => {
    const filtrosAtualizados: FiltroAvancado[] = [];

    for (const campo of Object.keys(filtrosColuna)) {
      const filtro = filtrosColuna[campo];
      if (filtro && filtro.valor && filtro.valor.trim() !== '') {
        filtrosAtualizados.push({
          campo,
          tipo: filtro.tipo || 'contém',
          valor: filtro.valor,
        });
      }
    }

    setFiltros(filtrosAtualizados);
    setPage(1);
  }, [filtrosColuna]);

  // Alterar tipo de filtro rapido de uma coluna
  const handleTipoFiltroRapidoChange = useCallback((header: string, tipo: string) => {
    setFiltrosColuna(prev => ({
      ...prev,
      [header]: { tipo, valor: prev[header]?.valor || '' },
    }));
  }, []);

  // Reset de filtros
  const resetFiltros = useCallback(() => {
    setFiltros([]);
    setSearch('');
    setFiltroStatus('');
    setFiltroTipoEntrada('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroFornecedor('');
    setFiltrosColuna({});
    setPage(1);
  }, []);

  // Reset de selecao
  const resetSelecao = useCallback(() => {
    setSelectedRows([]);
  }, []);

  // Obter parametros para API
  const getApiParams = useCallback(() => {
    return {
      page,
      perPage,
      search,
      filtros,
      status: filtroStatus,
      tipoEntrada: filtroTipoEntrada,
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim,
      fornecedor: filtroFornecedor,
    };
  }, [
    page,
    perPage,
    search,
    filtros,
    filtroStatus,
    filtroTipoEntrada,
    filtroDataInicio,
    filtroDataFim,
    filtroFornecedor,
  ]);

  // Verificar se ha filtros ativos
  const hasActiveFilters = useCallback(() => {
    return (
      filtros.length > 0 ||
      search.trim() !== '' ||
      filtroStatus !== '' ||
      filtroTipoEntrada !== '' ||
      filtroDataInicio !== '' ||
      filtroDataFim !== '' ||
      filtroFornecedor !== ''
    );
  }, [filtros, search, filtroStatus, filtroTipoEntrada, filtroDataInicio, filtroDataFim, filtroFornecedor]);

  // Contar filtros ativos
  const countActiveFilters = useCallback(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    if (filtroStatus !== '') count++;
    if (filtroTipoEntrada !== '') count++;
    if (filtroDataInicio !== '' || filtroDataFim !== '') count++;
    if (filtroFornecedor !== '') count++;
    return count + filtros.length;
  }, [filtros, search, filtroStatus, filtroTipoEntrada, filtroDataInicio, filtroDataFim, filtroFornecedor]);

  // Obter informacoes de selecao
  const getSelectionInfo = useCallback(() => {
    return {
      selectedCount: selectedRows.length,
      hasSelection: selectedRows.length > 0,
      selectedRows,
    };
  }, [selectedRows]);

  return {
    // Estado
    search,
    page,
    perPage,
    headers,
    selectedRows,
    filtros,
    limiteColunas: limiteColunasState,

    // Filtros avancados
    filtroStatus,
    filtroTipoEntrada,
    filtroDataInicio,
    filtroDataFim,
    filtroFornecedor,

    // Filtros rapidos (por coluna)
    mostrarFiltrosRapidos,
    filtrosColuna,

    // Setters de filtros avancados
    setFiltroStatus,
    setFiltroTipoEntrada,
    setFiltroDataInicio,
    setFiltroDataFim,
    setFiltroFornecedor,

    // Handlers
    handleSearchChange,
    handleSearchKeyDown,
    handleSearchBlur,
    handlePageChange,
    handlePerPageChange,
    handleRowSelect,
    handleSelectAll,
    handleFiltroChange,
    handleColunaSubstituida,
    handleLimiteColunasChange,
    aplicarFiltrosAvancados,

    // Handlers de filtros rapidos
    handleFiltroRapidoChange,
    handleToggleFiltrosRapidos,
    aplicarFiltrosRapidos,
    handleTipoFiltroRapidoChange,

    // Utilitarios
    resetFiltros,
    resetSelecao,
    getApiParams,
    hasActiveFilters,
    countActiveFilters,
    getSelectionInfo,

    // Configuracao
    salvarConfiguracao,
    getDefaultHeaders,
  };
};

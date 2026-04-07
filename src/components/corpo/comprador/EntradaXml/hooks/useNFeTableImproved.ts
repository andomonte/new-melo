import { useState, useEffect, useCallback } from 'react';
import { colunasDbNFe } from '../colunasDbNFe';

interface UseNFeTableImprovedProps {
  colunasIniciais?: string[];
  limiteColunas?: number;
  storageKey?: string;
}

export const useNFeTableImproved = ({
  colunasIniciais,
  limiteColunas = 8,
  storageKey = 'nfe-table-config',
}: UseNFeTableImprovedProps = {}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<{ campo: string; tipo: string; valor: string }[]>([]);
  const [limiteColunasState, setLimiteColunas] = useState(limiteColunas);

  // Inicializar headers com configuração salva ou padrão
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(storageKey);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        let savedHeaders = config.headers || [];

        // Garantir que não há duplicatas e que ações está na primeira posição
        savedHeaders = savedHeaders.filter((h: string) => h !== 'acoes');
        savedHeaders = ['acoes', ...savedHeaders];

        // Remover duplicatas
        savedHeaders = [...new Set(savedHeaders)];

        setHeaders(savedHeaders.length > 1 ? savedHeaders : getDefaultHeaders());
        setLimiteColunas(config.limiteColunas || limiteColunas);
      } else {
        setHeaders(getDefaultHeaders());
      }
    } catch (error) {
      console.error('Erro ao carregar configuração da tabela:', error);
      setHeaders(getDefaultHeaders());
    }
  }, [storageKey, limiteColunas]);

  // Salvar configuração no localStorage
  const salvarConfiguracao = useCallback((newHeaders: string[], newLimiteColunas: number) => {
    try {
      const config = {
        headers: newHeaders,
        limiteColunas: newLimiteColunas,
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (error) {
      console.error('Erro ao salvar configuração da tabela:', error);
    }
  }, [storageKey]);

  // Obter headers padrão
  const getDefaultHeaders = useCallback(() => {
    if (colunasIniciais) {
      return colunasIniciais;
    }

    // Iniciar com ações na primeira posição
    const headersPadrao = ['acoes'];

    // Adicionar colunas fixas (exceto ações)
    const colunasFixas = colunasDbNFe
      .filter(col => col.fixo && col.campo !== 'acoes')
      .map(col => col.campo);

    headersPadrao.push(...colunasFixas);

    // Adicionar colunas opcionais até o limite (reservando espaço para ações que já foi adicionado)
    const colunasOpcionais = colunasDbNFe
      .filter(col => !col.fixo)
      .map(col => col.campo);

    const espacoRestante = limiteColunas - headersPadrao.length;
    headersPadrao.push(...colunasOpcionais.slice(0, espacoRestante));

    return headersPadrao;
  }, [colunasIniciais, limiteColunas]);

  // Atualizar limite de colunas
  const handleLimiteColunasChange = useCallback((novoLimite: number) => {
    setLimiteColunas(novoLimite);

    // Recalcular headers baseado no novo limite
    // Manter colunas fixas (exceto ações) e ajustar as opcionais
    const colunasFixas = colunasDbNFe
      .filter(col => col.fixo && col.campo !== 'acoes')
      .map(col => col.campo);

    const colunasOpcionais = colunasDbNFe
      .filter(col => !col.fixo)
      .map(col => col.campo);

    // Headers atuais (removendo as fixas e ações)
    const headersAtuaisOpcionais = headers.filter(h => !colunasFixas.includes(h) && h !== 'acoes');

    // Calcular quantas colunas opcionais podemos ter com o novo limite (descontando ações na primeira posição)
    const limiteOpcionais = novoLimite - colunasFixas.length - 1;

    // Se temos mais headers que o limite, manter os primeiros
    let novosHeadersOpcionais = headersAtuaisOpcionais.slice(0, limiteOpcionais);

    // Se precisamos de mais headers, adicionar dos disponíveis
    if (novosHeadersOpcionais.length < limiteOpcionais) {
      const headersParaAdicionar = colunasOpcionais
        .filter(col => !novosHeadersOpcionais.includes(col))
        .slice(0, limiteOpcionais - novosHeadersOpcionais.length);
      novosHeadersOpcionais = [...novosHeadersOpcionais, ...headersParaAdicionar];
    }

    // Combinar: ações na primeira posição + colunas opcionais + colunas fixas
    const novosHeaders = ['acoes', ...novosHeadersOpcionais, ...colunasFixas];

    setHeaders(novosHeaders);
    salvarConfiguracao(novosHeaders, novoLimite);
  }, [headers, salvarConfiguracao]);

  // Substituir coluna
  const handleColunaSubstituida = useCallback((colunaA: string, colunaB: string, tipo: 'swap' | 'replace' = 'replace') => {
    setHeaders(prevHeaders => {
      const novosHeaders = [...prevHeaders];

      if (tipo === 'swap') {
        // Trocar posições
        const indexA = novosHeaders.indexOf(colunaA);
        const indexB = novosHeaders.indexOf(colunaB);

        if (indexA !== -1 && indexB !== -1) {
          [novosHeaders[indexA], novosHeaders[indexB]] = [novosHeaders[indexB], novosHeaders[indexA]];
        }
      } else {
        // Substituir coluna
        const index = novosHeaders.indexOf(colunaA);
        if (index !== -1) {
          novosHeaders[index] = colunaB;
        }
      }

      salvarConfiguracao(novosHeaders, limiteColunas);
      return novosHeaders;
    });
  }, [limiteColunas, salvarConfiguracao]);

  // Handlers para busca
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset para primeira página
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Disparar busca imediatamente
      setPage(1);
    }
  }, []);

  const handleSearchBlur = useCallback(() => {
    // Disparar busca quando perder foco
    setPage(1);
  }, []);

  // Handlers para paginação
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset para primeira página
  }, []);

  // Handlers para seleção
  const handleRowSelect = useCallback((selected: boolean, rowData: any) => {
    const rowId = rowData.id?.toString() || '';

    setSelectedRows(prev => {
      if (selected) {
        return [...prev, rowId];
      } else {
        return prev.filter(id => id !== rowId);
      }
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      // Selecionar todos os IDs da página atual
      // Nota: você precisará passar os dados das linhas para calcular isso
      setSelectedRows([]);
    } else {
      setSelectedRows([]);
    }
  }, []);

  // Handler para filtros
  const handleFiltroChange = useCallback((novosFiltros: { campo: string; tipo: string; valor: string }[]) => {
    setFiltros(novosFiltros);
    setPage(1); // Reset para primeira página
  }, []);

  // Reset de filtros
  const resetFiltros = useCallback(() => {
    setFiltros([]);
    setSearch('');
    setPage(1);
  }, []);

  // Reset de seleção
  const resetSelecao = useCallback(() => {
    setSelectedRows([]);
  }, []);

  // Obter parâmetros para API
  const getApiParams = useCallback(() => {
    return {
      page,
      perPage,
      search,
      filtros,
    };
  }, [page, perPage, search, filtros]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useCallback(() => {
    return filtros.length > 0 || search.trim() !== '';
  }, [filtros, search]);

  // Obter informações de seleção
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

    // Utilitários
    resetFiltros,
    resetSelecao,
    getApiParams,
    hasActiveFilters,
    getSelectionInfo,

    // Configuração
    salvarConfiguracao,
    getDefaultHeaders,
  };
};
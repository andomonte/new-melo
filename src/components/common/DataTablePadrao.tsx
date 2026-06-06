import React, { ChangeEvent, KeyboardEvent, useState, useRef, useEffect } from 'react';
import { Meta } from '@/data/common/meta';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, Filter, FilterX, BarChart3, Check, CheckCheckIcon, Columns3, Eye, EyeOff, GripVertical } from 'lucide-react';
import { RiFileExcel2Line, RiFilePdf2Line } from 'react-icons/ri';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import SelectInput from './SelectInput2';
import { Select as RadixSelect, SelectTrigger as RadixSelectTrigger, SelectValue as RadixSelectValue, SelectContent as RadixSelectContent, SelectItem as RadixSelectItem } from '@/components/ui/select';
import SearchInput from './SearchInput';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { obterNomeAmigavel } from '@/utils/mapeamentoColunas';
import Carregamento from '@/utils/carregamento';

const tiposDeFiltro = [
  { label: 'Começa com', value: 'começa' },
  { label: 'Contém', value: 'contém' },
  { label: 'Diferente', value: 'diferente' },
  { label: 'É nulo', value: 'nulo' },
  { label: 'Igual', value: 'igual' },
  { label: 'Maior ou igual', value: 'maior_igual' },
  { label: 'Maior que', value: 'maior' },
  { label: 'Menor ou igual', value: 'menor_igual' },
  { label: 'Menor que', value: 'menor' },
  { label: 'Não é nulo', value: 'nao_nulo' },
  { label: 'Termina com', value: 'termina' },
];

interface DataTablePadraoProps {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
  loading?: boolean;
  /** Alias para loading (compatibilidade com DataTableFiltro) */
  carregando?: boolean;
  noDataMessage?: string | React.ReactNode;
  onFiltroChange?: (filtros: { campo: string; tipo: string; valor: string }[]) => void;
  colunasFiltro?: string[];
  onExportarExcel?: () => void;
  onDashboardGeral?: () => void;
  columnWidths?: string[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortableColumns?: string[];
  nonsortableColumns?: string[];
  screenKey?: string;
  userName?: string;
  initialFilters?: Record<string, { tipo: string; valor: string }>;
  statusFilterOptions?: { value: string; label: string }[];
  /** Props do DataTableFiltro para compatibilidade */
  semColunaDeAcaoPadrao?: boolean;
  onRowClick?: (row: any) => void;
  renderCell?: (row: any, header: string) => React.ReactNode;
  limiteColunas?: number;
  onLimiteColunasChange?: (novoLimite: number) => void;
  customHeaderActions?: React.ReactNode;
}

export default function DataTablePadrao({
  headers,
  rows,
  meta,
  onPageChange,
  onPerPageChange,
  onSearch,
  onSearchKeyDown,
  searchInputPlaceholder,
  loading,
  noDataMessage = 'Nenhum dado encontrado.',
  onFiltroChange,
  colunasFiltro = [],
  onExportarExcel,
  onDashboardGeral,
  columnWidths,
  onSort,
  sortableColumns,
  nonsortableColumns = ['Ações', '☑️'],
  screenKey,
  userName,
  initialFilters,
  statusFilterOptions,
  carregando,
  onSearchBlur,
  semColunaDeAcaoPadrao,
  onRowClick,
  renderCell,
  limiteColunas,
  onLimiteColunasChange,
  customHeaderActions,
}: DataTablePadraoProps) {
  // Compatibilidade: aceita 'loading' ou 'carregando'
  const isLoading = loading || carregando || false;
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarModalFiltroAvancado, setMostrarModalFiltroAvancado] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, { tipo: string; valor: string }>>(initialFilters || {});
  const [termoBuscaGlobal, setTermoBuscaGlobal] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(headers);
  const [mostrarSeletorColunas, setMostrarSeletorColunas] = useState(false);
  const [ordemColunas, setOrdemColunas] = useState<string[]>(headers);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [prefsCarregadas, setPrefsCarregadas] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar preferências do banco ao montar
  useEffect(() => {
    if (!screenKey || !userName) {
      setPrefsCarregadas(true);
      return;
    }

    fetch(`/api/userPreferences?user=${encodeURIComponent(userName)}&screen=${encodeURIComponent(screenKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          const p = data.preferences;
          if (Array.isArray(p.colunasVisiveis) && p.colunasVisiveis.length > 0) {
            setColunasVisiveis(p.colunasVisiveis);
          }
          if (Array.isArray(p.ordemColunas) && p.ordemColunas.length > 0) {
            setOrdemColunas(p.ordemColunas);
          }
          if (p.sortColumn) setSortColumn(p.sortColumn);
          if (p.sortDirection) setSortDirection(p.sortDirection);
          if (p.perPage && onPerPageChange) onPerPageChange(Number(p.perPage));
          if (typeof p.mostrarFiltros === 'boolean') setMostrarFiltros(p.mostrarFiltros);
        }
      })
      .catch((err) => console.error('Erro ao carregar preferências:', err))
      .finally(() => setPrefsCarregadas(true));
  }, [screenKey, userName]);

  // Salvar preferências no banco (com debounce de 1s)
  const salvarPreferencias = (overrides?: Record<string, any>) => {
    if (!screenKey || !userName) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const prefs = {
        colunasVisiveis,
        ordemColunas,
        sortColumn,
        sortDirection,
        perPage: meta?.perPage,
        mostrarFiltros,
        ...overrides,
      };

      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, screen: screenKey, preferences: prefs }),
      }).catch((err) => console.error('Erro ao salvar preferências:', err));
    }, 1000);
  };

  // Salvar quando mudar colunas visíveis, ordem ou ordenação
  useEffect(() => {
    if (prefsCarregadas) {
      salvarPreferencias();
    }
  }, [colunasVisiveis, ordemColunas, sortColumn, sortDirection, mostrarFiltros]);

  // Inicializar colunas visíveis e ordem quando headers mudar
  useEffect(() => {
    if (!prefsCarregadas) return;

    // Sempre sincronizar ordemColunas com headers disponíveis
    // Mantém a ordem existente + adiciona novas colunas que apareceram
    const colunasAtuais = new Set(ordemColunas);
    const novasColunas = headers.filter(h => !colunasAtuais.has(h));
    if (novasColunas.length > 0 || ordemColunas.length === 0) {
      const ordemAtualizada = [
        ...ordemColunas.filter(h => headers.includes(h)), // mantém ordem existente, remove as que sumiram
        ...novasColunas, // adiciona novas no final
      ];
      setOrdemColunas(ordemAtualizada.length > 0 ? ordemAtualizada : headers);
    }

    // Se não tem colunas visíveis definidas, mostra as 10 primeiras por padrão
    if (colunasVisiveis.length === 0) {
      setColunasVisiveis(headers.slice(0, Math.min(10, headers.length)));
    } else {
      // Remove colunas visíveis que não existem mais nos headers
      const visiveisValidas = colunasVisiveis.filter(h => headers.includes(h));
      if (visiveisValidas.length !== colunasVisiveis.length) {
        setColunasVisiveis(visiveisValidas.length > 0 ? visiveisValidas : headers.slice(0, 10));
      }
    }
  }, [headers]);

  // Ordenação por coluna
  const isColumnSortable = (header: string) => {
    if (nonsortableColumns?.includes(header)) return false;
    if (sortableColumns && sortableColumns.length > 0) return sortableColumns.includes(header);
    return true;
  };

  const handleSort = (header: string) => {
    if (!isColumnSortable(header)) return;

    let newDir: 'asc' | 'desc' = 'asc';
    if (sortColumn === header) {
      newDir = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    setSortColumn(header);
    setSortDirection(newDir);
    onSort?.(header, newDir);
  };

  // Funções para arrastar e reordenar
  const handleDragStart = (index: number) => {
    setArrastando(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (arrastando === null || arrastando === index) return;

    const newOrder = [...ordemColunas];
    const draggedItem = newOrder[arrastando];
    newOrder.splice(arrastando, 1);
    newOrder.splice(index, 0, draggedItem);
    
    setOrdemColunas(newOrder);
    setArrastando(index);
  };

  const handleDragEnd = () => {
    setArrastando(null);
  };

  const handleFiltroAvancado = (filtros: { campo: string; tipo: string; valor: string }[]) => {
    console.log('🔍 Filtros avançados recebidos:', filtros);
    onFiltroChange?.(filtros);
    setMostrarModalFiltroAvancado(false);
  };

  const handleInputChange = (key: string, value: string) => {
    console.log(`🔍 Filtro rápido alterado - Campo: ${key}, Valor: ${value}`);
    setFiltrosColuna((prev) => ({
      ...prev,
      [key]: { tipo: prev[key]?.tipo || 'contém', valor: value },
    }));
    
    if (termoBuscaGlobal !== '') setTermoBuscaGlobal('');
    
    // Debounce the filter application
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      aplicarFiltro();
    }, 300);
  };

  const aplicarFiltro = () => {
    // Enviar TODOS os filtros, incluindo os vazios (para remover filtros anteriores)
    const filtrosAtualizados = Object.entries(filtrosColuna)
      .map(([campo, { tipo, valor }]) => ({ campo, tipo, valor }));
    
    console.log('🔍 Aplicando filtros rápidos (incluindo vazios):', filtrosAtualizados);
    onFiltroChange?.(filtrosAtualizados);
  };

  // Página visual — muda IMEDIATO ao clicar, busca no banco com debounce
  const paginaVisualRef = useRef(meta?.currentPage || 1);
  const [paginaVisual, setPaginaVisual] = useState(meta?.currentPage || 1);
  const [navegando, setNavegando] = useState(false);
  const navegarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza quando meta atualiza (dados voltaram da API)
  useEffect(() => {
    if (meta?.currentPage) {
      paginaVisualRef.current = meta.currentPage;
      setPaginaVisual(meta.currentPage);
      setNavegando(false);
    }
  }, [meta?.currentPage]);

  const navegarPagina = (pagina: number) => {
    // Label muda IMEDIATO
    paginaVisualRef.current = pagina;
    setPaginaVisual(pagina);
    // Loading aparece IMEDIATO
    setNavegando(true);

    // Busca no banco só depois de 1.5s sem clicar
    if (navegarTimeoutRef.current) clearTimeout(navegarTimeoutRef.current);
    navegarTimeoutRef.current = setTimeout(() => {
      onPageChange(paginaVisualRef.current);
    }, 1500);
  };

  const handlePreviousPage = () => {
    const prox = paginaVisualRef.current - 1;
    if (prox >= 1) navegarPagina(prox);
  };

  const handleNextPage = () => {
    const prox = paginaVisualRef.current + 1;
    if (prox <= (meta?.lastPage || 1)) navegarPagina(prox);
  };

  const handlePerPageChangeInternal = (value: string) => {
    if (onPerPageChange) {
      onPerPageChange(Number(value));
    }
    salvarPreferencias({ perPage: Number(value) });
  };

  const perPageOptions: { value: string; label: string }[] = [
    { value: '10', label: '10' },
    { value: '20', label: '20' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
    { value: '500', label: '500' },
    { value: '1000', label: '1000' },
  ];

  useEffect(() => {
    const calcularLargura = () => {
      const larguraContainer =
        containerRef.current?.offsetWidth ?? window.innerWidth;
      const larguraDisponivel = larguraContainer - 250;
      setLarguraTabela(larguraDisponivel);
    };
    calcularLargura();
    window.addEventListener('resize', calcularLargura);
    return () => window.removeEventListener('resize', calcularLargura);
  }, []);

  return (
    <div className="flex flex-col w-full gap-2 flex-1 min-h-0">
    {/* ===== CARD: Busca + Tabela ===== */}
    <div className="relative border border-gray-300 dark:border-gray-300 bg-white dark:bg-zinc-900 rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm">
      {/* Cabeçalho de busca */}
      <div className="border-b border-gray-200 dark:border-zinc-700 p-2">
        <div className="flex justify-between items-center gap-2">
          <SearchInput
            placeholder={searchInputPlaceholder ?? 'Pesquisar...'}
            onChange={(e) => {
              const valor = e.target.value;
              console.log('🔍 Busca global alterada:', valor);
              setTermoBuscaGlobal(valor);
              
              // Limpar filtros de coluna quando usar busca global
              if (valor.trim() !== '' && Object.keys(filtrosColuna).length > 0) {
                console.log('🔍 Limpando filtros de coluna para busca global');
                setFiltrosColuna({});
                onFiltroChange?.([]);
              }
              
              onSearch?.(e);
            }}
            onKeyDown={onSearchKeyDown}
          />
          
          <div className="flex items-center gap-2">
            {/* Dialog para Filtros Avançados */}
            <Dialog
              open={mostrarModalFiltroAvancado}
              onOpenChange={setMostrarModalFiltroAvancado}
            >
              <DialogContent className="max-w-[90vw] w-[90vw] max-h-full p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                  <DialogTitle className="text-lg text-gray-800 dark:text-white uppercase">
                    Filtros avançados por coluna
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                    Selecione os campos e aplique os filtros desejados.
                  </DialogDescription>
                </DialogHeader>
                <FiltroDinamicoDeClientes
                  colunas={colunasFiltro}
                  onChange={handleFiltroAvancado}
                />
              </DialogContent>
            </Dialog>

            {/* Botão Opções com Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs text-gray-700 dark:text-white">
                  <span className="text-xs">⚙️</span> <span>Opções</span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-44 bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-600 text-xs text-gray-700 dark:text-white cursor-pointer">
                {/* Toggle Filtros rápidos */}
                <DropdownMenuItem
                  onClick={() => {
                    setMostrarFiltros((prev) => {
                      const novoEstado = !prev;
                      if (!novoEstado) {
                        console.log('🔍 Limpando todos os filtros rápidos');
                        setFiltrosColuna({});
                        onFiltroChange?.([]);
                      }
                      return novoEstado;
                    });
                  }}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                >
                  {mostrarFiltros ? (
                    <FilterX
                      size={16}
                      className="mr-2 size-4 text-amber-500 dark:text-amber-300"
                    />
                  ) : (
                    <Filter className="mr-2 size-4 text-amber-500 dark:text-amber-300" />
                  )}
                  {mostrarFiltros
                    ? 'Ocultar filtros rápidos'
                    : 'Mostrar filtros rápidos'}
                </DropdownMenuItem>

                {/* Modal de Filtros avançados */}
                <DropdownMenuItem
                  onClick={() => setMostrarModalFiltroAvancado(true)}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                >
                  <Filter className="mr-2 size-4 text-blue-500 dark:text-blue-300" />
                  Filtros avançados
                </DropdownMenuItem>

                {/* Exportar para Excel */}
                {onExportarExcel && (
                  <DropdownMenuItem
                    onClick={onExportarExcel}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    <RiFileExcel2Line className="mr-2 size-4 text-green-600 dark:text-green-400" />
                    Exportar para Excel
                  </DropdownMenuItem>
                )}

                {/* Dashboard Geral */}
                {onDashboardGeral && (
                  <DropdownMenuItem
                    onClick={onDashboardGeral}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    <BarChart3 className="mr-2 size-4 text-cyan-600 dark:text-cyan-400" />
                    Dashboard Geral
                  </DropdownMenuItem>
                )}

                {/* Ações customizadas (dentro do DropdownMenu) */}
                {customHeaderActions}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="relative flex-1 min-h-0 overflow-auto" ref={containerRef}>
          {/* Loading Melo — overlay fixo na área visível do grid */}
          {(isLoading || navegando) && (
            <div className="absolute inset-0 z-20 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center">
              <Carregamento texto="Carregando..." />
            </div>
          )}
          {/* Mensagem centralizada quando não há dados */}
          {rows?.length === 0 && !isLoading && !navegando && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {noDataMessage}
              </div>
            </div>
          )}
          <div className="min-w-max">
            <table className="table-auto w-full border-collapse text-xs text-center">
            <colgroup>
              {columnWidths && columnWidths.length > 0 ? (
                columnWidths.map((width, index) => (
                  <col key={index} style={{ width }} />
                ))
              ) : (
                ordemColunas.filter(h => colunasVisiveis.includes(h)).map((header, i) => {
                  const narrow = header === '☑️' ? '70px' : header === 'Ações' ? '50px' : undefined;
                  return <col key={i} style={narrow ? { width: narrow, maxWidth: narrow } : { minWidth: '70px' }} />;
                })
              )}
            </colgroup>
            
            {/* Cabeçalho da tabela - fixo */}
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800 border-b border-gray-300 dark:border-zinc-700">
              <tr>
                {ordemColunas.map((header, index) => {
                  if (!colunasVisiveis.includes(header)) return null;
                  const sortable = isColumnSortable(header);
                  const isActive = sortColumn === header;
                  return (
                    <th
                      key={index}
                      className={`px-2 py-1.5 text-center text-[11px] font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider select-none ${
                        sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors' : ''
                      }`}
                      style={header === '☑️' ? { width: '40px', maxWidth: '40px' } : header === 'Ações' ? { width: '50px', maxWidth: '50px' } : undefined}
                      onClick={() => sortable && handleSort(header)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{obterNomeAmigavel(header)}</span>
                        {sortable && (
                          <span className="inline-flex flex-col">
                            {isActive ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp size={14} className="text-blue-600 dark:text-blue-400" />
                              ) : (
                                <ChevronDown size={14} className="text-blue-600 dark:text-blue-400" />
                              )
                            ) : (
                              <ArrowUpDown size={12} className="text-gray-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* Linha de Filtros Rápidos */}
              {mostrarFiltros && (
                <tr>
                  {ordemColunas.map((header, index) => (
                    colunasVisiveis.includes(header) && (
                      <th
                        key={`filter-${index}`}
                        className="px-2 py-1 bg-gray-50 dark:bg-zinc-900"
                        style={header === '☑️' ? { width: '40px', maxWidth: '40px' } : header === 'Ações' ? { width: '50px', maxWidth: '50px' } : undefined}
                      >
                      {header === 'Status' ? (
                        <RadixSelect
                          value={filtrosColuna['status']?.valor || 'todos'}
                          onValueChange={(novoValor) => {
                            const valor = novoValor === 'todos' ? '' : novoValor;
                            const novosFiltros = { ...filtrosColuna };
                            if (valor) {
                              novosFiltros.status = { tipo: 'igual', valor };
                            } else {
                              delete novosFiltros.status;
                            }
                            setFiltrosColuna(novosFiltros);
                            onFiltroChange?.(
                              Object.entries(novosFiltros)
                                .filter(([, { valor: v }]) => v !== '')
                                .map(([campo, { tipo, valor: v }]) => ({ campo, tipo, valor: v }))
                            );
                          }}
                        >
                          <RadixSelectTrigger className="h-6 text-[10px] px-1.5">
                            <RadixSelectValue />
                          </RadixSelectTrigger>
                          <RadixSelectContent>
                            <RadixSelectItem value="todos">Todos</RadixSelectItem>
                            {(statusFilterOptions || [
                              { value: 'pendente_parcial', label: 'Pendente/Parcial' },
                              { value: 'pago', label: 'Pago' },
                              { value: 'cancelado', label: 'Cancelado' },
                            ]).map((opt) => (
                              <RadixSelectItem key={opt.value} value={opt.value}>{opt.label}</RadixSelectItem>
                            ))}
                          </RadixSelectContent>
                        </RadixSelect>
                      ) : header === '☑️' ? (
                        <RadixSelect
                          value={filtrosColuna['check']?.valor || 'todos'}
                          onValueChange={(novoValor) => {
                            const valor = novoValor === 'todos' ? '' : novoValor;
                            setFiltrosColuna(prev => ({
                              ...prev,
                              check: { tipo: 'igual', valor }
                            }));
                            onFiltroChange?.([
                              ...Object.entries(filtrosColuna)
                                .filter(([key]) => key !== 'check')
                                .map(([campo, { tipo, valor: v }]) => ({ campo, tipo, valor: v })),
                              { campo: 'check', tipo: 'igual', valor }
                            ]);
                          }}
                        >
                          <RadixSelectTrigger className="h-6 text-[10px] px-1">
                            <RadixSelectValue />
                          </RadixSelectTrigger>
                          <RadixSelectContent>
                            <RadixSelectItem value="todos">Todos</RadixSelectItem>
                            <RadixSelectItem value="true">Sim</RadixSelectItem>
                            <RadixSelectItem value="false">Não</RadixSelectItem>
                          </RadixSelectContent>
                        </RadixSelect>
                      ) : header !== 'Ações' ? (
                        <input
                          type="text"
                          placeholder={`Filtrar ${obterNomeAmigavel(header)}...`}
                          value={filtrosColuna[header.toLowerCase()]?.valor || ''}
                          onChange={(e) => handleInputChange(header.toLowerCase(), e.target.value)}
                          onBlur={() => {
                            if (debounceRef.current) {
                              clearTimeout(debounceRef.current);
                            }
                            aplicarFiltro();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (debounceRef.current) {
                                clearTimeout(debounceRef.current);
                              }
                              aplicarFiltro();
                            }
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                        />
                      ) : null}
                      </th>
                    )
                  ))}
                </tr>
              )}
            </thead>

            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">{
              rows?.length === 0 ? (
                null
              ) : (
                (() => {
                  // Filtro local do ☑️
                  let filteredRows = rows;
                  const checkFilter = filtrosColuna['check']?.valor;
                  if (checkFilter && checkFilter !== '') {
                    const checkColIndex = headers.indexOf('☑️');
                    if (checkColIndex !== -1) {
                      filteredRows = filteredRows.filter((row) => {
                        const cell = row[checkColIndex];
                        // Verifica se é um input checkbox e se está checked
                        const isChecked = cell?.props?.checked || cell?.props?.defaultChecked || false;
                        return checkFilter === 'true' ? isChecked : !isChecked;
                      });
                    }
                  }

                  // Ordenação local pelas colunas
                  let sortedRows = filteredRows;
                  if (sortColumn) {
                    const colIndex = headers.indexOf(sortColumn);
                    if (colIndex !== -1) {
                      sortedRows = [...filteredRows].sort((a, b) => {
                        let valA = Array.isArray(a) ? a[colIndex] : a[sortColumn];
                        let valB = Array.isArray(b) ? b[colIndex] : b[sortColumn];

                        // Extrai texto de elementos React
                        const extractText = (v: any): string => {
                          if (v == null) return '';
                          if (typeof v === 'string') return v;
                          if (typeof v === 'number') return String(v);
                          if (typeof v === 'object' && v?.props) {
                            // React element — tenta children
                            const c = v.props?.children;
                            if (typeof c === 'string') return c;
                            if (typeof c === 'number') return String(c);
                            if (Array.isArray(c)) return c.map(extractText).join('');
                            if (c?.props) return extractText(c);
                          }
                          return String(v);
                        };

                        const textA = extractText(valA).trim();
                        const textB = extractText(valB).trim();

                        // Tenta comparar como data BR (DD/MM/YYYY)
                        const parseDataBR = (s: string) => {
                          const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                          if (!m) return null;
                          return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
                        };

                        const dataA = parseDataBR(textA);
                        const dataB = parseDataBR(textB);

                        // Tenta comparar como número (remove R$, pontos, troca vírgula)
                        const parseNum = (s: string) => {
                          const limpo = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                          const n = Number(limpo);
                          return Number.isFinite(n) ? n : null;
                        };

                        const numA = parseNum(textA);
                        const numB = parseNum(textB);

                        let cmp: number;
                        if (dataA !== null && dataB !== null) {
                          cmp = dataA - dataB;
                        } else if (numA !== null && numB !== null) {
                          cmp = numA - numB;
                        } else {
                          cmp = textA.localeCompare(textB, 'pt-BR', { sensitivity: 'base' });
                        }

                        return sortDirection === 'asc' ? cmp : -cmp;
                      });
                    }
                  }
                  return sortedRows;
                })().map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {ordemColunas.map((header) => {
                      const cellIndex = headers.indexOf(header);
                      if (!colunasVisiveis.includes(header) || cellIndex === -1) return null;
                      // Suporta rows como array (ContasPagar) ou objeto (DataTableFiltro)
                      const value = Array.isArray(row) ? row[cellIndex] : row[header];
                      const isLastColumn = cellIndex === headers.length - 1;
                      return (
                        <td
                          key={cellIndex}
                          className={`px-2 py-1 text-xs text-gray-900 dark:text-gray-100 ${
                            isLastColumn ? 'text-center' : 'text-center'
                          }`}
                        >
                          <div className={isLastColumn ? 'flex justify-center items-center' : ''}>
                            {value}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
      </div>
    </div>

    {/* ===== RODAPÉ: Paginação + Gerenciador de Colunas ===== */}
    <div className="flex-shrink-0 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-1.5 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <span className="text-xs">Qtd. Itens:</span>
          <SelectInput
            name="itemsPagina"
            label=""
            value={meta?.perPage?.toString() ?? ''}
            options={perPageOptions}
            onValueChange={handlePerPageChangeInternal}
          />

          {/* Botão de Seleção de Colunas */}
          <div className="relative">
            <button
              onClick={() => setMostrarSeletorColunas(!mostrarSeletorColunas)}
              className="flex items-center gap-1.5 px-2 py-1 border rounded-md bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600 text-xs text-gray-700 dark:text-white border-gray-300 dark:border-zinc-600 transition-colors"
            >
              <Columns3 size={16} />
              <span>Colunas ({colunasVisiveis.length}/{ordemColunas.length})</span>
            </button>

            {/* Dropdown de Seleção de Colunas */}
            {mostrarSeletorColunas && (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-h-96 overflow-y-auto bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-xl z-50">
                <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">Gerenciar Colunas</span>
                    <button
                      onClick={() => setMostrarSeletorColunas(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setColunasVisiveis([...headers])}
                      className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      Mostrar Todas
                    </button>
                    <button
                      onClick={() => {
                        setOrdemColunas([...headers]);
                        setColunasVisiveis([...headers]);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                      Resetar Ordem
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Arraste para reordenar</p>
                  {ordemColunas.map((header, index) => (
                    <div
                      key={header}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 px-2 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded cursor-move group ${
                        arrastando === index ? 'opacity-50 bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <GripVertical size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <input
                        type="checkbox"
                        checked={colunasVisiveis.includes(header)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setColunasVisiveis([...colunasVisiveis, header]);
                          } else {
                            setColunasVisiveis(colunasVisiveis.filter((col) => col !== header));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white flex-1">
                        {obterNomeAmigavel(header)}
                      </span>
                      {colunasVisiveis.includes(header) ? (
                        <Eye size={14} className="text-blue-500" />
                      ) : (
                        <EyeOff size={14} className="text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 items-center text-xs text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Ir para página:</span>
            <input
              type="number"
              min="1"
              max={meta?.lastPage}
              value={paginaVisual}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= (meta?.lastPage || 1)) {
                  navegarPagina(v);
                }
              }}
              className="w-16 px-2 py-1 text-center text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">de {isLoading && !meta?.total ? <span className="inline-block h-3 w-6 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse align-middle" /> : (meta?.lastPage || 1)}</span>
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => navegarPagina(1)}
              disabled={paginaVisual === 1}
              className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Primeira página"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={handlePreviousPage}
              disabled={paginaVisual === 1}
              className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="whitespace-nowrap text-xs">
              Página {paginaVisual} de {isLoading && !meta?.total ? <span className="inline-block h-3 w-6 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse align-middle" /> : (meta?.lastPage || 1)}
            </span>
            <button
              onClick={handleNextPage}
              disabled={paginaVisual >= (meta?.lastPage || 1)}
              className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Próxima página"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => navegarPagina(meta?.lastPage || 1)}
              disabled={paginaVisual >= (meta?.lastPage || 1)}
              className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Última página"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

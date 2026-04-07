import React, { ChangeEvent, KeyboardEvent, useState, useRef, useEffect } from 'react';
import { Meta } from '@/data/common/meta';
import { ChevronLeft, ChevronRight, Filter, FilterX, BarChart3, Check, CheckCheckIcon, Columns3, Eye, EyeOff, GripVertical } from 'lucide-react';
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
import SearchInput from './SearchInput';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { obterNomeAmigavel } from '@/utils/mapeamentoColunas';

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

interface DataTableContasPagarProps {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  searchInputPlaceholder?: string;
  loading?: boolean;
  noDataMessage?: string;
  onFiltroChange?: (filtros: { campo: string; tipo: string; valor: string }[]) => void;
  colunasFiltro?: string[];
  onExportarExcel?: () => void;
  onDashboardGeral?: () => void;
  columnWidths?: string[]; // Nova prop para larguras customizadas
}

export default function DataTableContasPagar({
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
  columnWidths, // Adicionar nova prop
}: DataTableContasPagarProps) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarModalFiltroAvancado, setMostrarModalFiltroAvancado] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, { tipo: string; valor: string }>>({});
  const [termoBuscaGlobal, setTermoBuscaGlobal] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(headers);
  const [mostrarSeletorColunas, setMostrarSeletorColunas] = useState(false);
  const [ordemColunas, setOrdemColunas] = useState<string[]>(headers);
  const [arrastando, setArrastando] = useState<number | null>(null);

  // Inicializar colunas visíveis e ordem quando headers mudar
  useEffect(() => {
    if (colunasVisiveis.length === 0) {
      setColunasVisiveis(headers);
    }
    if (ordemColunas.length === 0 || ordemColunas.length !== headers.length) {
      setOrdemColunas(headers);
    }
  }, [headers]);

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

  const handlePreviousPage = () => {
    if (meta.currentPage > 1) {
      onPageChange(meta.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (meta.currentPage < meta.lastPage) {
      onPageChange(meta.currentPage + 1);
    }
  };

  const handlePerPageChangeInternal = (value: string) => {
    if (onPerPageChange) {
      onPerPageChange(Number(value));
    }
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
    <div className="border border-gray-300 dark:border-gray-300 bg-white dark:bg-zinc-900 rounded-lg flex flex-col w-full min-h-0 overflow-hidden">
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
                <button className="inline-flex items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm text-gray-700 dark:text-white">
                  <span className="text-base">⚙️</span> <span>Opções</span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-48 bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-white cursor-pointer">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="flex-1 min-h-0 overflow-auto" ref={containerRef}>
        <div className="min-h-0 max-h-[calc(80vh-10rem)] overflow-auto pb-8">
          <div
            className="min-w-full max-w-max mx-auto"
            style={{ width: larguraTabela }}
          >
            <table className="table-auto w-full border-collapse text-sm text-center">
            <colgroup>
              {columnWidths && columnWidths.length > 0 ? (
                // Se columnWidths for fornecido, usar esses valores
                columnWidths.map((width, index) => (
                  <col key={index} style={{ width }} />
                ))
              ) : (
                // Caso contrário, usar minWidth em vez de width para responsividade
                <>
                  <col style={{ minWidth: '60px' }} /> {/* ID */}
                  <col style={{ minWidth: '70px' }} /> {/* Tipo */}
                  <col style={{ minWidth: '120px' }} /> {/* Credor */}
                  <col style={{ minWidth: '90px' }} /> {/* Emissão */}
                  <col style={{ minWidth: '90px' }} /> {/* Vencimento */}
                  <col style={{ minWidth: '90px' }} /> {/* Pagamento */}
                  <col style={{ minWidth: '100px' }} /> {/* Valor Total */}
                  <col style={{ minWidth: '100px' }} /> {/* Valor Pago */}
                  <col style={{ minWidth: '70px' }} /> {/* Juros */}
                  <col style={{ minWidth: '80px' }} /> {/* Status */}
                  <col style={{ minWidth: '70px' }} /> {/* Nº NF */}
                  <col style={{ minWidth: '80px' }} /> {/* Nº Duplicata */}
                  <col style={{ minWidth: '90px' }} /> {/* Banco */}
                  <col style={{ minWidth: '90px' }} /> {/* Centro Custo */}
                  <col style={{ minWidth: '70px' }} /> {/* Conta */}
                  <col style={{ minWidth: '90px' }} /> {/* Comprador */}
                  <col style={{ minWidth: '80px' }} /> {/* Ações */}
                </>
              )}
            </colgroup>
            
            {/* Cabeçalho da tabela - fixo */}
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800 border-b border-gray-300 dark:border-zinc-700">
              <tr>
                {ordemColunas.map((header, index) => (
                  colunasVisiveis.includes(header) && (
                    <th
                      key={index}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider"
                    >
                      {obterNomeAmigavel(header)}
                    </th>
                  )
                ))}
              </tr>

              {/* Linha de Filtros Rápidos */}
              {mostrarFiltros && (
                <tr>
                  {ordemColunas.map((header, index) => (
                    colunasVisiveis.includes(header) && (
                      <th
                        key={`filter-${index}`}
                        className="px-2 py-1 bg-gray-50 dark:bg-zinc-900"
                      >
                      {header === 'Status' ? (
                        <select
                          value={filtrosColuna['status']?.valor || ''}
                          onChange={(e) => {
                            const novoValor = e.target.value;
                            console.log('🔍 Filtro rápido alterado - Campo: status, Valor:', novoValor);
                            setFiltrosColuna(prev => ({
                              ...prev,
                              status: { tipo: 'igual', valor: novoValor }
                            }));
                            // Aplicar filtro imediatamente com o novo valor
                            onFiltroChange?.([
                              ...Object.entries(filtrosColuna)
                                .filter(([key]) => key !== 'status')
                                .map(([campo, { tipo, valor }]) => ({ campo, tipo, valor })),
                              { campo: 'status', tipo: 'igual', valor: novoValor }
                            ]);
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          <option value="pendente_parcial">Pendente/Pago Parcial</option>
                          <option value="pago">Pago</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : header !== 'Ações' && header !== `${<CheckCheckIcon/>}` ? (
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
              loading ? (
                <tr>
                  <td colSpan={headers.length} className="px-6 py-10 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : rows?.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-6 py-10 text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      {noDataMessage}
                    </p>
                  </td>
                </tr>
              ) : (
                rows?.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {ordemColunas.map((header) => {
                      const cellIndex = headers.indexOf(header);
                      if (!colunasVisiveis.includes(header) || cellIndex === -1) return null;
                      const value = row[cellIndex];
                      const isLastColumn = cellIndex === headers.length - 1;
                      return (
                        <td
                          key={cellIndex}
                          className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${
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

      {/* Rodapé fixo com paginação */}
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <span className="text-sm">Qtd. Itens:</span>
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
                className="flex items-center gap-1 px-3 py-1.5 border rounded-md bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600 text-sm text-gray-700 dark:text-white border-gray-300 dark:border-zinc-600"
              >
                <Columns3 size={16} />
                <span>Colunas ({colunasVisiveis.length}/{ordemColunas.length})</span>
              </button>
              
              {/* Dropdown de Seleção de Colunas */}
              {mostrarSeletorColunas && (
                <div className="absolute bottom-full left-0 mb-2 w-64 max-h-96 overflow-y-auto bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg z-50">
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
                        onClick={() => setColunasVisiveis(ordemColunas)}
                        className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                      >
                        Mostrar Todas
                      </button>
                      <button
                        onClick={() => setOrdemColunas(headers)}
                        className="flex-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded"
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
          <div className="flex gap-4 items-center text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-sm">Ir para página:</span>
              <input
                type="number"
                min="1"
                max={meta?.lastPage}
                defaultValue={meta?.currentPage}
                placeholder={`1-${meta?.lastPage || 1}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt(e.currentTarget.value);
                    if (page >= 1 && page <= (meta?.lastPage || 1)) {
                      onPageChange(page);
                    }
                  }
                }}
                className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">de {meta?.lastPage || 1}</span>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handlePreviousPage}
                disabled={meta?.currentPage === 1}
                className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="whitespace-nowrap">
                Página {meta?.currentPage} de {meta?.lastPage}
              </span>
              <button
                onClick={handleNextPage}
                disabled={meta?.currentPage === meta?.lastPage}
                className="p-1 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

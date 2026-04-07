import React, {
  ChangeEvent,
  KeyboardEvent,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Meta } from '@/data/common/meta';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Filter,
  FilterX,
} from 'lucide-react';
import { RiFileExcel2Line } from 'react-icons/ri';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import ModalExportarExcel from '@/components/common/modalExportarExcel';
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
import Carregamento from '@/utils/carregamento';
import SelectInput from '@/components/common/SelectInput2';
import SearchInput from '@/components/common/SearchInput2';
import { colunasDbNFe } from '../colunasDbNFe';

// Mapeamento de campo para label legível
const getHeaderLabel = (campo: string): string => {
  const coluna = colunasDbNFe.find(col => col.campo === campo);
  return coluna?.label || campo.toUpperCase();
};

interface DataTableProps {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
  onFiltroChange?: (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => void;
  colunasFiltro?: string[];
  carregando: boolean;
  onColunaSubstituida?: (
    colunaA: string,
    colunaB: string,
    tipo?: 'swap' | 'replace',
  ) => void;
  limiteColunas: number;
  onLimiteColunasChange: (novoLimite: number) => void;
  // Props específicas para requisições
  colunasFixas?: string[];
  exportEndpoint?: string;
  exportFileName?: string;
  // Ações customizadas no menu Opções
  customActions?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[];
}

export default function DataTableNFe({
  carregando,
  headers,
  rows,
  meta,
  limiteColunas,
  onLimiteColunasChange,
  onPageChange,
  onPerPageChange,
  onSearch,
  onSearchKeyDown,
  onSearchBlur,
  searchInputPlaceholder,
  onFiltroChange,
  colunasFiltro = [],
  onColunaSubstituida,
  colunasFixas = [],
  exportEndpoint,
  exportFileName = 'dados.xlsx',
  customActions = [],
}: DataTableProps) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<
    Record<string, { tipo: string; valor: string }>
  >({});
  const [colunaEmEdicao, setColunaEmEdicao] = useState<string | null>(null);
  const [termoBuscaGlobal, setTermoBuscaGlobal] = useState('');
  const [termoBuscaDropdown, setTermoBuscaDropdown] = useState('');
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);
  const [mostrarModalFiltro, setMostrarModalFiltro] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [posicaoCliqueX, setPosicaoCliqueX] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);
  const [filtrosAvancados, setFiltrosAvancados] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);
  // CRITICAL FIX: Headers prop is used directly, no need to override
  // This ensures the table respects the column configuration from useRequisicoesTable
  const açõesColumnWidth = 80;

  // Função para verificar se uma coluna é fixa
  const isColumnFixed = (header: string): boolean => {
    return colunasFixas.includes(header);
  };

  const colunasDisponiveis = colunasFiltro
    .filter((col) => !isColumnFixed(col) && col !== colunaEmEdicao)
    .sort();

  const perPageOptions = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];

  useEffect(() => {
    const calcularLargura = () => {
      if (containerRef.current) {
        setLarguraTabela(containerRef.current.offsetWidth);
      }
    };

    calcularLargura();
    window.addEventListener('resize', calcularLargura);
    return () => window.removeEventListener('resize', calcularLargura);
  }, []);

  const handlePreviousPage = () => {
    if (meta.page > 1) onPageChange(meta.page - 1);
  };

  const handleNextPage = () => {
    if (meta.page < meta.lastPage) onPageChange(meta.page + 1);
  };

  const handlePerPageChange = (value: string) => {
    if (onPerPageChange) {
      onPerPageChange(parseInt(value));
    }
  };

  // Função para lidar com mudanças nos filtros de coluna
  const handleInputChange = (key: string, value: string) => {
    setFiltrosColuna((prev) => ({
      ...prev,
      [key]: { tipo: prev[key]?.tipo || 'contém', valor: value },
    }));
    if (termoBuscaGlobal !== '') setTermoBuscaGlobal('');
  };

  // Handler para filtros avançados do modal
  const handleFiltroChange = (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => {
    setFiltrosAvancados(filtros);
    onFiltroChange?.(filtros);
    setMostrarModalFiltro(false);
  };

  const aplicarFiltro = (filtrosOverride?: Record<string, { tipo: string; valor: string }>) => {
    const filtrosParaUsar = filtrosOverride ?? filtrosColuna;
    const filtrosAtualizados: { campo: string; tipo: string; valor: string }[] =
      [];

    Object.entries(filtrosParaUsar).forEach(([campo, { tipo, valor }]) => {
      if (valor.trim()) {
        filtrosAtualizados.push({ campo, tipo, valor: valor.trim() });
      }
    });

    setFiltrosAvancados(filtrosAtualizados);
    onFiltroChange?.(filtrosAtualizados);
  };

  return (
    // ALTURA ESPECÍFICA PARA NFE - Mais espaço para rodapé
    <div ref={containerRef} className="border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded-lg flex flex-col w-full overflow-hidden" style={{ height: 'calc(100vh - 200px)', maxWidth: '100%' }}>
      {/* Cabeçalho de busca e filtros */}
      <div className="border-b border-gray-200 dark:border-zinc-700 p-2">
        <div className="flex justify-between items-center gap-2">
          <SearchInput
            placeholder={searchInputPlaceholder ?? 'Pesquisar...'}
            value={termoBuscaGlobal}
            onChange={(e) => {
              setTermoBuscaGlobal(e.target.value);
              setFiltrosColuna({}); // limpando filtros avançados
              onSearch?.(e); // mantém a lógica externa
            }}
            onKeyDown={onSearchKeyDown}
            onBlur={onSearchBlur}
          />

          <div className="flex items-center gap-2">
            {/* Modal de Filtros Avançados */}
            <Dialog
              open={mostrarModalFiltro}
              onOpenChange={setMostrarModalFiltro}
            >
              <DialogContent className="max-w-[90vw] w-[90vw] max-h-full p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                  <DialogTitle className="text-lg text-gray-800 dark:text-white uppercase">
                    Filtros Avançados por Coluna
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                    Selecione os campos e aplique os filtros desejados.
                  </DialogDescription>
                </DialogHeader>
                <FiltroDinamicoDeClientes
                  colunas={colunasFiltro}
                  onChange={handleFiltroChange}
                />
              </DialogContent>
            </Dialog>

            {/* Botão Opções */}
            <Dialog
              open={mostrarModalExportar}
              onOpenChange={setMostrarModalExportar}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-50 dark:hover:bg-zinc-800">
                    Opções
                    <ChevronDown size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Toggle Filtros rápidos */}
                  <DropdownMenuItem
                    onClick={() => {
                      setMostrarFiltros((prev) => {
                        const novoEstado = !prev;
                        if (!novoEstado) {
                          setFiltrosColuna({});
                          onFiltroChange?.([]);
                        }
                        return novoEstado;
                      });
                    }}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    {mostrarFiltros ? (
                      <FilterX size={16} className="mr-2 text-amber-500 dark:text-amber-300" />
                    ) : (
                      <Filter size={16} className="mr-2 text-amber-500 dark:text-amber-300" />
                    )}
                    {mostrarFiltros ? 'Ocultar filtros rápidos' : 'Mostrar filtros rápidos'}
                  </DropdownMenuItem>

                  {/* Modal de Filtros avançados */}
                  <DropdownMenuItem
                    onClick={() => setMostrarModalFiltro(true)}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    <Filter size={16} className="mr-2 text-blue-500 dark:text-blue-300" />
                    Filtros Avançados
                  </DropdownMenuItem>

                  {/* Exportar Excel */}
                  {exportEndpoint && (
                    <DropdownMenuItem
                      onClick={() => setMostrarModalExportar(true)}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                      <RiFileExcel2Line size={16} className="mr-2 text-green-500 dark:text-green-300" />
                      Exportar Excel
                    </DropdownMenuItem>
                  )}

                  {/* Ações customizadas */}
                  {customActions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={action.onClick}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                  <DialogTitle className="text-lg text-gray-800 dark:text-white uppercase">
                    Escolha as colunas a serem exportadas
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                    Selecione os campos a serem incluídos na exportação.
                  </DialogDescription>
                </DialogHeader>

                <ModalExportarExcel
                  exportando={exportando}
                  colunas={colunasFiltro ?? []}
                  colunasVisiveis={headers.filter((h) => !isColumnFixed(h))}
                  onExportar={async (selecionadas) => {
                    setExportando(true);
                    try {
                      const res = await fetch(exportEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          colunas: selecionadas,
                          filtros: filtrosAvancados,
                          busca: termoBuscaGlobal,
                        }),
                      });

                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = exportFileName;
                      a.click();
                      window.URL.revokeObjectURL(url);

                      setMostrarModalExportar(false);
                    } catch (error) {
                      console.error('Erro na exportação:', error);
                    } finally {
                      setExportando(false);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-h-0 max-h-[calc(90vh-16rem)] overflow-auto pb-8">
            <div className="min-w-full max-w-max mx-auto">
              <table className="table-auto w-full border-collapse text-sm text-center">
              <thead className="sticky top-0 z-10 dark:bg-gray-100 border-b border-gray-300 dark:border-zinc-700">
                <tr>
                  {headers.map((header, index) => (
                    <th
                      key={index}
                      className={`relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center ${
                        isColumnFixed(header) ? 'w-[80px]' : 'min-w-[140px]'
                      }`}
                    >
                      {!isColumnFixed(header) ? (
                        <div
                          onClick={(e) => {
                            const cliqueX = e.clientX;
                            setPosicaoCliqueX(cliqueX);
                            setColunaEmEdicao(
                              colunaEmEdicao === header ? null : header,
                            );
                          }}
                          className="flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {getHeaderLabel(header)}
                          {colunaEmEdicao === header ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          {getHeaderLabel(header)}
                        </div>
                      )}

                      {/* Dropdown de troca de coluna */}
                      {colunaEmEdicao === header && !isColumnFixed(header) && (
                        <div
                          ref={dropdownRef}
                          className={`font-normal absolute z-20 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow max-h-48 overflow-y-auto w-auto text-center ${
                            posicaoCliqueX !== null &&
                            posicaoCliqueX > window.innerWidth - 250
                              ? 'right-0'
                              : 'left-0'
                          } max-w-[calc(100vw-2rem)]`}
                        >
                          <input
                            type="text"
                            placeholder="Buscar coluna..."
                            value={termoBuscaDropdown}
                            onChange={(e) => setTermoBuscaDropdown(e.target.value)}
                            className="w-full px-2 py-1 text-sm border-b border-gray-200 dark:border-zinc-600 focus:outline-none dark:bg-zinc-800"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {colunasDisponiveis
                            .filter((col) =>
                              col.toLowerCase().includes(termoBuscaDropdown.toLowerCase()) ||
                              getHeaderLabel(col).toLowerCase().includes(termoBuscaDropdown.toLowerCase())
                            )
                            .map((coluna) => (
                              <div
                                key={coluna}
                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                                onClick={() => {
                                  onColunaSubstituida?.(header, coluna, 'replace');
                                  setColunaEmEdicao(null);
                                  setTermoBuscaDropdown('');
                                }}
                              >
                                {getHeaderLabel(coluna)}
                              </div>
                            ))}
                          {colunasDisponiveis.filter((col) =>
                            col.toLowerCase().includes(termoBuscaDropdown.toLowerCase()) ||
                            getHeaderLabel(col).toLowerCase().includes(termoBuscaDropdown.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              Nenhuma coluna encontrada
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
                {mostrarFiltros && (
                  <tr className="bg-gray-200 dark:dark:bg-zinc-800">
                    {headers.map((header, index) =>
                      !isColumnFixed(header) ? (
                        <th key={index} className="px-2 py-1 font-normal">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder={`FILTRAR POR ${getHeaderLabel(header)}`}
                              value={filtrosColuna[header]?.valor || ''}
                              onChange={(e) =>
                                handleInputChange(header, e.target.value)
                              }
                              onKeyDown={(e) =>
                                e.key === 'Enter' && aplicarFiltro()
                              }
                              onBlur={() => aplicarFiltro()}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded dark:bg-zinc-700 dark:text-white"
                            />
                            {filtrosColuna[header]?.valor && (
                              <button
                                onClick={() => {
                                  const novosFiltros = {
                                    ...filtrosColuna,
                                    [header]: { ...filtrosColuna[header], valor: '' },
                                  };
                                  setFiltrosColuna(novosFiltros);
                                  aplicarFiltro(novosFiltros);
                                }}
                                className="absolute right-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </th>
                      ) : (
                        <th key={index} className="px-2 py-1"></th>
                      ),
                    )}
                  </tr>
                )}
              </thead>

              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={headers.length} className="py-8">
                      <Carregamento texto="Carregando..." />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="py-8 text-gray-500 dark:text-gray-400">
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700"
                    >
                      {headers.map((header, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-2 py-2 text-center border-b border-gray-200 dark:border-zinc-700"
                          style={
                            isColumnFixed(header)
                              ? { width: `${açõesColumnWidth}px` }
                              : {}
                          }
                        >
                          {typeof row[header] === 'object' && row[header] !== null
                            ? row[header]
                            : row[header] || '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé específico para NFe - Mais espaço */}
      <div className="flex-shrink-0 border-t border-gray-300 dark:border-zinc-500 bg-gray-200 dark:bg-zinc-800 px-2 py-3 min-h-[4rem]">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300 flex-shrink-0">
            {/* Select de Qtd. Itens */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Qtd. Itens:</span>
              <SelectInput
                name="itemsPagina"
                label=""
                value={meta?.perPage?.toString() ?? '10'}
                options={perPageOptions}
                onValueChange={handlePerPageChange}
              />
            </div>

            {/* Select de Qtd. Colunas */}
            <div className="flex items-center gap-2 min-w-[140px]">
              <span className="text-sm font-medium whitespace-nowrap">Qtd. Colunas:</span>
              <SelectInput
                name="colunasPagina"
                label=""
                value={limiteColunas?.toString()}
                options={Array.from({ length: colunasFiltro.filter(col => !isColumnFixed(col)).length }, (_, i) => ({
                  label: `${i + 1}`,
                  value: `${i + 1}`,
                }))}
                onValueChange={(val) => onLimiteColunasChange(parseInt(val))}
              />
            </div>
          </div>
          <div className="flex gap-2 items-center text-sm flex-shrink-0">
            <button
              type="button"
              onClick={handlePreviousPage}
              disabled={meta?.page === 1}
              className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="whitespace-nowrap text-sm">
              Página {meta?.page || 1} de {meta?.lastPage || 1}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={meta?.page === meta?.lastPage}
              className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
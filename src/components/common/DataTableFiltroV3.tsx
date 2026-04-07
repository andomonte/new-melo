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
  Filter,
  FilterX,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import { RiFileExcel2Line, RiFilePdfLine } from 'react-icons/ri';
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
import SelectInput from './SelectInput2';
import SearchInput from './SearchInput2';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';

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
  // Mapeamento de campo -> label para exibição
  columnLabels?: Record<string, string>;
}

export default function DataTable({
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
  colunasFixas = ['selecionar', 'SELECIONAR', 'AÇÕES', 'ações', 'AÇÕES'],
  exportEndpoint = '/api/requisicoesCompra/exportar',
  exportFileName = 'requisicoes.xlsx',
  customActions = [],
  columnLabels = {},
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
  const [posicaoCliqueX, setPosicaoCliqueX] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);
  const [filtrosAvancados, setFiltrosAvancados] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);

  // Garantir que AÇÕES esteja sempre na primeira posição
  const orderedHeaders = React.useMemo(() => {
    const acoesVariants = ['AÇÕES', 'ações', 'acoes', 'Ações'];
    const headersFiltered = headers.filter(h => !acoesVariants.includes(h));
    const hasAcoes = headers.some(h => acoesVariants.includes(h));
    return hasAcoes ? ['AÇÕES', ...headersFiltered] : headers;
  }, [headers]);

  const açõesColumnWidth = 80;

  // Função para obter o label de uma coluna
  const getLabel = (campo: string): string => {
    return columnLabels[campo] || campo;
  };

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
      const larguraContainer =
        containerRef.current?.offsetWidth ?? window.innerWidth;
      setLarguraTabela(larguraContainer);
    };
    calcularLargura();
    window.addEventListener('resize', calcularLargura);
    return () => window.removeEventListener('resize', calcularLargura);
  }, []);

  const handlePreviousPage = () => {
    if (meta.currentPage > 1) onPageChange(meta.currentPage - 1);
  };

  const handleNextPage = () => {
    if (meta.currentPage < meta.lastPage) onPageChange(meta.currentPage + 1);
  };

  const handlePerPageChange = (value: string) => {
    if (onPerPageChange) {
      onPerPageChange(Number(value));
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFiltrosColuna((prev) => ({
      ...prev,
      [key]: { tipo: prev[key]?.tipo || 'contém', valor: value },
    }));
    // Limpar busca global quando usar filtro de coluna
    if (termoBuscaGlobal !== '') {
      setTermoBuscaGlobal('');
      onSearch?.({ target: { value: '' } } as any);
    }
  };

  const handleFiltroChange = (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => {
    setFiltrosAvancados(filtros);
    onFiltroChange?.(filtros);
    setMostrarModalFiltro(false);
  };

  // Mapeamento reverso para status (Aprovada → A, Reprovada → R, etc)
  const mapStatusToCode = (valor: string): string => {
    const statusReverseMap: Record<string, string> = {
      'pendente': 'P',
      'submetida': 'S',
      'aprovada': 'A',
      'reprovada': 'R',
      'rejeitada': 'R',
      'cancelada': 'C',
      'em análise': 'E',
      'finalizada': 'F',
    };

    const valorLower = valor.toLowerCase().trim();
    return statusReverseMap[valorLower] || valor;
  };

  const aplicarFiltro = () => {
    const filtrosAtualizados: { campo: string; tipo: string; valor: string }[] =
      [];

    for (const campo of Object.keys(filtrosColuna)) {
      const filtro = filtrosColuna[campo];
      if (
        filtro &&
        typeof filtro === 'object' &&
        'valor' in filtro &&
        'tipo' in filtro &&
        filtro.valor && // Só adiciona se valor não for vazio
        filtro.valor.trim() !== '' // Ignora valores vazios ou só espaços
      ) {
        let valorFiltro = filtro.valor ?? '';

        // Se for um campo de status, fazer mapeamento reverso
        if (campo.toLowerCase().includes('status')) {
          valorFiltro = mapStatusToCode(valorFiltro);
        }

        filtrosAtualizados.push({
          campo,
          tipo: filtro.tipo ?? 'contém',
          valor: valorFiltro,
        });
      }
    }

    onFiltroChange?.(filtrosAtualizados);
  };

  return (
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
            <Dialog
              open={mostrarModalFiltro}
              onOpenChange={setMostrarModalFiltro}
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
                  <button className="inline-flex items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm text-gray-700 dark:text-white">
                    <span className="text-base">⚙️</span> <span>Opções</span>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-48 bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-white">
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
                    onClick={() => setMostrarModalFiltro(true)}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    <Filter className="mr-2 size-4 text-blue-500 dark:text-blue-300" />
                    Filtros avançados
                  </DropdownMenuItem>

                  {/* Exportar Excel */}
                  <DropdownMenuItem
                    onClick={() => setMostrarModalExportar(true)}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    <div className="flex">
                      <div className="flex items-center">
                        <RiFileExcel2Line className="size-4 text-green-500 dark:text-green-300" />
                      </div>
                      <div className="px-2">Exportar</div>
                    </div>
                  </DropdownMenuItem>

                  {/* Ações customizadas */}
                  {customActions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={action.onClick}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                      <div className="flex items-center">
                        <div className="mr-2 size-4">
                          {action.icon}
                        </div>
                        <div>{action.label}</div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DialogContent className="max-w-[90vw] w-[90vw] max-h-full p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
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
                  colunasVisiveis={orderedHeaders.filter((h) => !isColumnFixed(h))}
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
        <div className="w-full overflow-x-auto overflow-y-auto flex-1">
          <div className="min-w-full">
              <table className="table-auto w-full border-collapse text-sm text-center">
              <thead className="sticky top-0 z-10 dark:bg-gray-100 border-b border-gray-300 dark:border-zinc-700">
                <tr>
                  {orderedHeaders.map((header, index) => (
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
                          {getLabel(header)}
                          {colunaEmEdicao === header ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          {getLabel(header)}
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
                            ref={inputRef}
                            type="text"
                            value={termoBuscaDropdown}
                            onChange={(e) =>
                              setTermoBuscaDropdown(e.target.value)
                            }
                            placeholder="Buscar coluna..."
                            className="w-full px-2 py-1 border-b border-gray-300 dark:border-zinc-600 text-sm"
                          />
                          {colunasDisponiveis
                            .filter((col) =>
                              col
                                .toLowerCase()
                                .includes(termoBuscaDropdown.toLowerCase()),
                            )
                            .map((col) => (
                              <div
                                key={col}
                                onClick={() => {
                                  const colJaVisivel = orderedHeaders.includes(col);

                                  if (colJaVisivel) {
                                    // Solicita troca de lugar
                                    onColunaSubstituida?.(header, col, 'swap');
                                  } else {
                                    // Substitui diretamente
                                    onColunaSubstituida?.(
                                      header,
                                      col,
                                      'replace',
                                    );
                                  }

                                  setColunaEmEdicao(null);
                                  setTermoBuscaDropdown('');
                                }}
                                className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                              >
                                {getLabel(col)}
                              </div>
                            ))}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
                {mostrarFiltros && (
                  <tr className="bg-gray-200 dark:dark:bg-zinc-800">
                    {orderedHeaders.map((header, index) =>
                      !isColumnFixed(header) ? (
                        <th key={index} className="px-2 py-1 font-normal">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder={`Filtrar por ${getLabel(header)}`}
                              value={filtrosColuna[header]?.valor || ''}
                              onChange={(e) =>
                                handleInputChange(header, e.target.value)
                              }
                              onKeyDown={(e) =>
                                e.key === 'Enter' && aplicarFiltro()
                              }
                              onBlur={(e) => {
                                // Só dispara aplicarFiltro se o novo foco NÃO for no botão!
                                if (
                                  !e.relatedTarget ||
                                  !dropdownRef.current?.contains(
                                    e.relatedTarget as Node,
                                  )
                                ) {
                                  aplicarFiltro();
                                }
                              }}
                              className="w-full font-normal px-2 py-1 border rounded-md text-[12px] pr-8"
                            />

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  className="absolute right-1 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                >
                                  <Filter size={16} />
                                </button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent
                                className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-white rounded-md shadow-lg w-40 max-h-48 overflow-y-auto"
                                ref={dropdownRef}
                              >
                                {tiposDeFiltro.map((tipo) => (
                                  <DropdownMenuItem
                                    key={tipo.value}
                                    onClick={() => {
                                      const novosFiltros = {
                                        ...filtrosColuna,
                                        [header]: {
                                          tipo: tipo.value,
                                          valor:
                                            filtrosColuna[header]?.valor ?? '',
                                        },
                                      };
                                      const filtrosArray = Object.entries(
                                        novosFiltros,
                                      ).map(([campo, { tipo, valor }]) => ({
                                        campo,
                                        tipo,
                                        valor,
                                      }));
                                      setFiltrosColuna(novosFiltros);
                                      onFiltroChange?.(filtrosArray);
                                    }}
                                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm p-2 flex justify-between items-center"
                                  >
                                    <span>{tipo.label}</span>
                                    {(filtrosColuna[header]?.tipo ??
                                      'igual') === tipo.value && (
                                      <Check
                                        size={16}
                                        className="text-green-600 dark:text-green-400"
                                      />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </th>
                      ) : (
                        <th key={index} />
                      ),
                    )}
                  </tr>
                )}
              </thead>

              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={orderedHeaders.length}>
                      <div className="flex justify-center items-center py-20">
                        <Carregamento texto="BUSCANDO DADOS" />
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={orderedHeaders.length} className="py-20 text-center">
                      Sem dados até o momento.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200"
                    >
                      {orderedHeaders.map((header, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-t border-gray-300 dark:border-zinc-600 px-4 py-2 whitespace-nowrap"
                        >
                          <div className="truncate">{row[header]}</div>
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

      {/* Rodapé fixo */}
      <div className="flex-shrink-0 border-t border-gray-300 dark:border-zinc-500 bg-gray-200 dark:bg-zinc-800 px-2 py-2 min-h-[3rem]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
            {/* Select de Qtd. Itens */}
            <div className="flex items-center gap-1">
              <span className="text-sm">Qtd. Itens:</span>
              <SelectInput
                name="itemsPagina"
                label=""
                value={meta?.perPage?.toString() ?? '10'}
                options={perPageOptions}
                onValueChange={handlePerPageChange}
              />
            </div>

            {/* Select de Qtd. Colunas */}
            <div className="flex items-center gap-1 min-w-[140px]">
              <span className="text-sm whitespace-nowrap">Qtd. Colunas:</span>
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
          <div className="flex gap-2 items-center text-sm">
            <button
              onClick={handlePreviousPage}
              disabled={meta?.currentPage === 1}
              className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="whitespace-nowrap">
              Página {meta?.currentPage} de {meta?.lastPage}
            </span>
            <button
              onClick={handleNextPage}
              disabled={meta?.currentPage === meta?.lastPage}
              className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
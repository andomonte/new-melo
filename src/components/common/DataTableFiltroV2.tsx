import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { RiFileExcel2Line } from 'react-icons/ri';
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
import SearchInput from './SearchInput';
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

interface DataTableV2Props {
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

export default function DataTableV2({
  carregando,
  headers: originalHeaders,
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
}: DataTableV2Props) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<
    Record<string, { tipo: string; valor: string }>
  >({});
  const [colunaEmEdicao, setColunaEmEdicao] = useState<string | null>(null);
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
  const headers = originalHeaders;

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
      const larguraDisponivel = larguraContainer - 250;
      setLarguraTabela(larguraDisponivel);
    };
    calcularLargura();
    window.addEventListener('resize', calcularLargura);
    return () => window.removeEventListener('resize', calcularLargura);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        !target.closest('.cursor-pointer')
      ) {
        setColunaEmEdicao(null);
      }
    };

    if (colunaEmEdicao) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [colunaEmEdicao]);

  const handlePreviousPage = () => {
    if (meta.currentPage > 1) onPageChange(meta.currentPage - 1);
  };

  const handleNextPage = () => {
    if (meta.currentPage < meta.lastPage) onPageChange(meta.currentPage + 1);
  };

  const handlePerPageChange = (value: string) => {
    if (onPerPageChange) onPerPageChange(Number(value));
  };

  const handleInputChange = (key: string, value: string) => {
    setFiltrosColuna((prev) => ({
      ...prev,
      [key]: { tipo: prev[key]?.tipo || 'contém', valor: value },
    }));
  };

  const handleFiltroChange = (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => {
    setFiltrosAvancados(filtros);
    onFiltroChange?.(filtros);
    setMostrarModalFiltro(false);
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
        'tipo' in filtro
      ) {
        filtrosAtualizados.push({
          campo,
          tipo: filtro.tipo ?? 'contém',
          valor: filtro.valor ?? '',
        });
      }
    }

    onFiltroChange?.(filtrosAtualizados);
  };

  const renderColGroup = () => {
    const totalCols = headers.length;
    
    return (
      <colgroup>
        {headers.map((header, index) => {
          // Primeira coluna (SELECIONAR) - 8%
          if (index === 0 || header.toUpperCase() === 'SELECIONAR') {
            return <col key={index} style={{ width: '8%' }} />;
          }
          // Última coluna (AÇÕES) - 8%
          else if (index === totalCols - 1 || header.toUpperCase() === 'AÇÕES') {
            return <col key={index} style={{ width: '8%' }} />;
          }
          // Colunas do meio - distribuir o restante igualmente
          else {
            const middleColWidth = (84 / (totalCols - 2)).toFixed(2);
            return <col key={index} style={{ width: `${middleColWidth}%` }} />;
          }
        })}
      </colgroup>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden max-w-full flex flex-col h-[calc(100vh-10rem)]">
      {/* Cabeçalho fixo */}
      <div>
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableHeader>
            {/* Linha do input – cor normal */}
            <TableRow className="bg-white dark:bg-zinc-900">
              <TableCell colSpan={headers.length} className="border-none">
                <div className="flex justify-between items-center px-2">
                  <SearchInput
                    placeholder={searchInputPlaceholder ?? 'Pesquisar...'}
                    onChange={onSearch}
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

                          {/* Exportar */}
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
                                  busca: '',
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
              </TableCell>
            </TableRow>

            {/* Linha dos nomes das colunas – cor alterada */}
            <TableRow className="bg-gray-100 dark:bg-zinc-800">
              {headers.map((header, index) => (
                <TableHead
                  key={index}
                  className="font-bold text-center text-gray-700 dark:text-gray-200 uppercase border-none relative"
                >
                  {!isColumnFixed(header) ? (
                    <>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const cliqueX = e.clientX;
                          setPosicaoCliqueX(cliqueX);
                          setColunaEmEdicao(
                            colunaEmEdicao === header ? null : header,
                          );
                        }}
                        className="flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {header}
                        {colunaEmEdicao === header ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </div>
                      
                      {/* Dropdown de troca de coluna */}
                      {colunaEmEdicao === header && (
                        <div
                          ref={dropdownRef}
                          className={`font-normal absolute z-20 top-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow max-h-48 overflow-y-auto w-48 text-center ${
                            posicaoCliqueX !== null &&
                            posicaoCliqueX > window.innerWidth - 250
                              ? 'right-0'
                              : 'left-0'
                          }`}
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
                                  const colJaVisivel = headers.includes(col);

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
                                className="px-2 py-1 uppercase hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                              >
                                {col}
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-center">
                      {header}
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
            
            {mostrarFiltros && (
              <TableRow className="bg-gray-200 dark:bg-zinc-800">
                {headers.map((header, index) =>
                  !isColumnFixed(header) ? (
                    <TableHead key={index} className="px-2 py-1 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={`FILTRAR POR ${header.toUpperCase()}`}
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
                    </TableHead>
                  ) : (
                    <TableHead key={index} />
                  ),
                )}
              </TableRow>
            )}
          </TableHeader>
        </Table>
      </div>

      {/* Corpo com scroll */}
      <div className="h-full flex-grow overflow-y-auto py-0">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 border-none"
                  style={{ height: 'calc(100vh - 16rem - 4rem)' }}
                >
                  <Carregamento texto="Carregando dados..." />
                </TableCell>
              </TableRow>
            ) : rows?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center border-none"
                  style={{ height: 'calc(100vh - 16rem - 4rem)' }}
                >
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Nenhum dado encontrado.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows?.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 border-none"
                >
                  {headers.map((header, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className="px-4 py-2 text-center border-none"
                    >
                      {row[header]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé fixo */}
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
        <Table className="min-w-full table-auto text-sm text-center text-gray-700 dark:text-gray-200">
          {renderColGroup()}
          <TableFooter>
            <TableRow>
              <TableCell colSpan={headers.length} className="border-none">
                <div className="flex justify-between items-center px-2 py-0">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-sm">Qtd. Itens:</span>
                    <SelectInput
                      name="itemsPagina"
                      label=""
                      value={meta?.perPage?.toString() ?? ''}
                      options={perPageOptions}
                      onValueChange={handlePerPageChange}
                    />
                    <span className="text-sm ml-4">Qtd. Colunas:</span>
                    <SelectInput
                      name="colunasPagina"
                      label=""
                      value={limiteColunas?.toString()}
                      options={colunasFiltro.map((_, i) => ({
                        label: `${i + 1}`,
                        value: `${i + 1}`,
                      }))}
                      onValueChange={(val) => onLimiteColunasChange(parseInt(val))}
                    />
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
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
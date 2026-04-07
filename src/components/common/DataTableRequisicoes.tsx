import React, { useState, useRef, useEffect } from 'react';
import { Meta } from '@/data/common/meta';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  FilterX,
  ChevronUp,
  ChevronDown,
  Check,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react';
import { RiFileExcel2Line } from 'react-icons/ri';
import ModalExportarExcel from '@/components/common/modalExportarExcel';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Carregamento from '@/utils/carregamento';
import SelectInput from './SelectInput2';
import SearchInput from './SearchInput2';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { colunasDbRequisicao } from '@/components/corpo/comprador/RequisicoesCompra/colunasDbRequisicao';

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

interface DataTableRequisicoesPros {
  headers: string[];
  rows: any[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
  onFiltroChange?: (filtros: { campo: string; tipo: string; valor: string }[]) => void;
  colunasFiltro?: any[];
  carregando: boolean;
  onColunaSubstituida?: (colunaA: string, colunaB: string, tipo?: 'swap' | 'replace') => void;
  limiteColunas: number;
  onLimiteColunasChange: (novoLimite: number) => void;
  onActionClick?: (action: string, rowData: any) => void;
  selectedRows?: string[];
  onRowSelect?: (selected: boolean, rowData: any) => void;
  onSelectAll?: (selected: boolean) => void;
}

export default function DataTableRequisicoes({
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
  onActionClick,
  selectedRows = [],
  onRowSelect,
  onSelectAll,
}: DataTableRequisicoesPros) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, { tipo: string; valor: string }>>({});
  const [colunaEmEdicao, setColunaEmEdicao] = useState<string | null>(null);
  const [termoBuscaGlobal, setTermoBuscaGlobal] = useState('');
  const [termoBuscaDropdown, setTermoBuscaDropdown] = useState('');
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<{ campo: string; tipo: string; valor: string }[]>([]);
  const [posicaoCliqueX, setPosicaoCliqueX] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Garantir que ações esteja sempre na primeira posição
  const headers = React.useMemo(() => {
    const acoesVariants = ['AÇÕES', 'ações', 'acoes', 'Ações'];
    const headersFiltered = originalHeaders.filter(h => !acoesVariants.includes(h));
    return ['acoes', ...headersFiltered];
  }, [originalHeaders]);

  // Renderizar status com badge colorido
  const renderStatus = (status: string) => {
    const statusMap = {
      'P': { label: 'Pendente', variant: 'secondary' as const },
      'S': { label: 'Submetida', variant: 'default' as const },
      'A': { label: 'Aprovada', variant: 'default' as const },
      'R': { label: 'Rejeitada', variant: 'destructive' as const },
      'C': { label: 'Cancelada', variant: 'outline' as const },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap];
    return (
      <Badge variant={statusInfo?.variant || 'secondary'}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  // Renderizar ações com base no status
  const renderActions = (rowData: any) => {
    const status = rowData.statusRequisicao;
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" type="button">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Ações sempre disponíveis */}
          <DropdownMenuItem onClick={() => onActionClick?.('ver', rowData)}>
            <Eye className="mr-2 h-4 w-4" />
            Ver
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onActionClick?.('itens', rowData)}>
            <FileText className="mr-2 h-4 w-4" />
            Itens
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Ações baseadas no status */}
          {status === 'P' && (
            <>
              <DropdownMenuItem onClick={() => onActionClick?.('editar', rowData)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActionClick?.('submeter', rowData)}>
                <Send className="mr-2 h-4 w-4" />
                Submeter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActionClick?.('excluir', rowData)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}

          {status === 'S' && (
            <>
              <DropdownMenuItem onClick={() => onActionClick?.('aprovar', rowData)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActionClick?.('reprovar', rowData)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reprovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActionClick?.('cancelar', rowData)}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}

          {(status === 'A' || status === 'R') && (
            <DropdownMenuItem onClick={() => onActionClick?.('duplicar', rowData)}>
              <FileText className="mr-2 h-4 w-4" />
              Duplicar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Renderizar células de dados
  const renderDataCell = (header: string, rowData: any) => {
    if (header === 'acoes' || header === 'ações') {
      return renderActions(rowData);
    }

    if (header === 'selecionar') {
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={selectedRows.includes(rowData.id?.toString() || '')}
            onCheckedChange={(checked) => onRowSelect?.(checked as boolean, rowData)}
            aria-label="Selecionar linha"
          />
        </div>
      );
    }

    if (header === 'statusRequisicao') {
      return renderStatus(rowData[header]);
    }

    // Formatação de data
    if (header.includes('data') || header.includes('Data')) {
      const date = rowData[header];
      if (date) {
        return new Date(date).toLocaleDateString('pt-BR');
      }
      return '-';
    }

    // Valor padrão
    return rowData[header] || '-';
  };

  // Efeito para fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setColunaEmEdicao(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const larguraTabela = `${Math.max(headers.length * 140, 800)}px`;
  const açõesColumnWidth = 100;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Barra de controles */}
      <div className="flex-none bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Controles da esquerda */}
          <div className="flex items-center gap-4">
            <SearchInput
              placeholder={searchInputPlaceholder || 'Pesquisar...'}
              onChange={onSearch}
              onKeyDown={onSearchKeyDown}
              onBlur={onSearchBlur}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="flex items-center gap-2"
            >
              <Filter size={16} />
              Filtros
            </Button>

            {filtrosAvancados.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltrosAvancados([]);
                  onFiltroChange?.([]);
                }}
                className="flex items-center gap-2"
              >
                <FilterX size={16} />
                Limpar
              </Button>
            )}
          </div>

          {/* Controles da direita */}
          <div className="flex items-center gap-4">
            <select 
              value={limiteColunas.toString()}
              onChange={(e) => onLimiteColunasChange(parseInt(e.target.value))}
              className="px-3 py-1 border rounded text-sm min-w-[120px]"
            >
              <option value="6">6 colunas</option>
              <option value="8">8 colunas</option>
              <option value="10">10 colunas</option>
              <option value="12">12 colunas</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarModalExportar(true)}
              className="flex items-center gap-2"
            >
              <RiFileExcel2Line size={16} />
              Exportar
            </Button>
          </div>
        </div>

        {/* Filtros avançados */}
        {mostrarFiltros && (
          <div className="mt-4 p-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded">
            <div className="text-sm text-gray-500">Filtros avançados em desenvolvimento</div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 w-full overflow-x-auto overflow-y-auto">
          <div className="min-w-full max-w-max mx-auto" style={{ width: larguraTabela }}>
            <table className="table-auto w-full border-collapse text-sm text-center">
              {/* Cabeçalho */}
              <thead className="sticky top-0 z-10 bg-gray-200 dark:bg-zinc-800 border-b border-gray-300 dark:border-zinc-700">
                <tr>
                  {headers.map((header, index) => {
                    if (header === 'acoes' || header === 'ações') {
                      return (
                        <th
                          key={index}
                          className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center"
                          style={{ width: `${açõesColumnWidth}px` }}
                        >
                          <div className="flex justify-center font-medium">
                            AÇÕES
                          </div>
                        </th>
                      );
                    }

                    if (header === 'selecionar') {
                      return (
                        <th
                          key={index}
                          className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center w-[60px]"
                        >
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selectedRows.length === rows.length && rows.length > 0}
                              onCheckedChange={onSelectAll}
                              aria-label="Selecionar todos"
                            />
                          </div>
                        </th>
                      );
                    }

                    // Verificar se a coluna é substituível
                    const colunaConfig = colunasDbRequisicao.find(col => col.campo === header);
                    const isSubstituivel = !colunaConfig?.fixo;

                    return (
                      <th
                        key={index}
                        className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center min-w-[140px]"
                      >
                        {isSubstituivel ? (
                          <div
                            onClick={(e) => {
                              const cliqueX = e.clientX;
                              setPosicaoCliqueX(cliqueX);
                              setColunaEmEdicao(colunaEmEdicao === header ? null : header);
                            }}
                            className="flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-zinc-700 rounded p-1"
                          >
                            {header.toUpperCase()}
                            {colunaEmEdicao === header ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-center font-medium">
                            {header.toUpperCase()}
                          </div>
                        )}

                        {/* Dropdown de troca de coluna */}
                        {colunaEmEdicao === header && isSubstituivel && (
                          <div
                            ref={dropdownRef}
                            className={`font-normal absolute z-20 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow-lg max-h-48 overflow-y-auto w-64 ${
                              posicaoCliqueX !== null && posicaoCliqueX > window.innerWidth - 250
                                ? 'right-0'
                                : 'left-0'
                            }`}
                          >
                            {/* Campo de busca */}
                            <div className="p-2 border-b border-gray-200 dark:border-zinc-600">
                              <input
                                type="text"
                                placeholder="Buscar coluna..."
                                value={termoBuscaDropdown}
                                onChange={(e) => setTermoBuscaDropdown(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                              />
                            </div>

                            {/* Lista de colunas */}
                            <div className="max-h-32 overflow-y-auto">
                              {colunasDbRequisicao
                                .filter((col) => 
                                  col.campo !== header && 
                                  !col.fixo && 
                                  col.label.toLowerCase().includes(termoBuscaDropdown.toLowerCase())
                                )
                                .map((coluna) => (
                                  <div
                                    key={coluna.campo}
                                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                                    onClick={() => {
                                      onColunaSubstituida?.(header, coluna.campo, 'replace');
                                      setColunaEmEdicao(null);
                                      setTermoBuscaDropdown('');
                                    }}
                                  >
                                    {coluna.label}
                                  </div>
                                ))}
                            </div>

                            {/* Mensagem se não encontrar colunas */}
                            {colunasDbRequisicao.filter((col) => 
                              col.campo !== header && 
                              !col.fixo && 
                              col.label.toLowerCase().includes(termoBuscaDropdown.toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                Nenhuma coluna encontrada
                              </div>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Corpo da tabela */}
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
                          style={header === 'acoes' || header === 'ações' ? { width: `${açõesColumnWidth}px` } : {}}
                        >
                          {renderDataCell(header, row)}
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

      {/* Paginação */}
      <div className="flex-none bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Mostrando {Math.min((meta.currentPage - 1) * meta.perPage + 1, meta.total)} a{' '}
              {Math.min(meta.currentPage * meta.perPage, meta.total)} de {meta.total} resultados
            </span>

            {onPerPageChange && (
              <select 
                value={meta.perPage.toString()}
                onChange={(e) => onPerPageChange(parseInt(e.target.value))}
                className="px-3 py-1 border rounded text-sm min-w-[140px]"
              >
                <option value="10">10 por página</option>
                <option value="25">25 por página</option>
                <option value="50">50 por página</option>
                <option value="100">100 por página</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.currentPage - 1)}
              disabled={meta.currentPage <= 1}
            >
              <ChevronLeft size={16} />
              Anterior
            </Button>

            <span className="text-sm text-gray-600 dark:text-gray-400">
              Página {meta.currentPage} de {Math.ceil(meta.total / meta.perPage)}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.currentPage + 1)}
              disabled={meta.currentPage >= Math.ceil(meta.total / meta.perPage)}
            >
              Próxima
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de exportação */}
      <Dialog open={mostrarModalExportar} onOpenChange={setMostrarModalExportar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar para Excel</DialogTitle>
            <DialogDescription>
              Selecione as colunas que deseja exportar
            </DialogDescription>
          </DialogHeader>
          <ModalExportarExcel
            exportando={exportando}
            colunas={colunasFiltro.map(col => col.campo || col)}
            colunasVisiveis={headers.filter((h) => h !== 'acoes' && h !== 'ações')}
            onExportar={async (selecionadas) => {
              setExportando(true);
              try {
                const res = await fetch('/api/requisicoesCompra/exportar', {
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
                a.download = 'requisicoes.xlsx';
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
  );
}
/**
 * Lista de Devoluções de compra (fat_devolucao) — as iniciadas no web pela alocação
 * (falta, danificado, errado) e o histórico do Delphi. Abre nas abertas: aguardando a
 * emissão da NF de devolução.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Eye, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DefaultButton } from '@/components/common/Buttons';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import Carregamento from '@/utils/carregamento';
import SearchInput from '@/components/common/SearchInput2';
import SelectInput from '@/components/common/SelectPadrao';
import api from '@/components/services/api';

interface DevolucaoListProps {
  onVerDetalhe: (id: string) => void;
  onNova?: () => void;
  refreshKey?: number;
}

interface DevolucaoRow {
  id: string;
  numero_entrada: string;
  fornecedor: string;
  nfe_numero: string | null;
  status: string;
  origem: string;
  programa?: string | null;
  observacao: string | null;
  codvenda: string | null;
  total_itens: number;
  qtd_total_devolucao: number;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ABERTA: { label: 'Aguardando emissão', variant: 'default' },
  NF_PENDENTE: { label: 'NF pendente (transmitir)', variant: 'destructive' },
  FINALIZADA: { label: 'NF emitida', variant: 'outline' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};

const HEADERS = [
  { key: 'acoes', label: 'Ações', fixed: true },
  { key: 'id', label: 'Nº Devolução', fixed: false },
  { key: 'numero_entrada', label: 'Nº Entrada', fixed: false },
  { key: 'nfe_numero', label: 'NF', fixed: false },
  { key: 'fornecedor', label: 'Fornecedor', fixed: false },
  { key: 'observacao', label: 'Obs.', fixed: false },
  { key: 'total_itens', label: 'Itens', fixed: false },
  { key: 'qtd_total_devolucao', label: 'Qtd Total', fixed: false },
  { key: 'status', label: 'Status', fixed: false },
  { key: 'origem', label: 'Origem', fixed: false },
  { key: 'created_at', label: 'Data', fixed: false },
];

const PER_PAGE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'ABERTA', label: 'Aguardando emissão' },
  { value: 'FINALIZADA', label: 'NF emitida' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'ALL', label: 'Todas' },
];

export const DevolucaoList: React.FC<DevolucaoListProps> = ({
  onVerDetalhe,
  onNova,
  refreshKey,
}) => {
  const [data, setData] = useState<DevolucaoRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [perPage, setPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ABERTA');
  const [abertasWeb, setAbertasWeb] = useState(0);

  const fetchData = useCallback(async (page = 1, busca = '', status = '') => {
    setLoading(true);
    try {
      const response = await api.get('/api/devolucao/list', {
        params: {
          page,
          limit: perPage,
          busca: busca || undefined,
          status: status && status !== 'ALL' ? status : undefined,
        },
      });
      if (response.data?.success) {
        setData(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
        setAbertasWeb(Number(response.data.abertasWeb) || 0);
      }
    } catch (err) {
      console.error('Erro ao carregar devoluções:', err);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => {
    fetchData(1, searchTerm, statusFilter);
  }, [refreshKey, perPage, statusFilter]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') fetchData(1, searchTerm, statusFilter);
  };

  const handleSearchBlur = () => {
    fetchData(1, searchTerm, statusFilter);
  };

  const fmtDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const fmtQtd = (v: number) => {
    const num = parseFloat(String(v)) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const renderCell = (header: typeof HEADERS[number], row: DevolucaoRow) => {
    switch (header.key) {
      case 'acoes':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" type="button">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onVerDetalhe(row.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case 'status': {
        const info = STATUS_MAP[row.status] || { label: row.status, variant: 'secondary' as const };
        return <Badge variant={info.variant}>{info.label}</Badge>;
      }
      case 'created_at':
        return fmtDate(row.created_at);
      case 'id':
        return <span className="font-medium">{row.id}</span>;
      case 'nfe_numero':
        return row.nfe_numero || '-';
      case 'observacao':
        return <span className="truncate max-w-[220px] inline-block">{row.observacao || '-'}</span>;
      case 'origem':
        return row.origem === 'WEB'
          ? <Badge variant="secondary">{row.programa === 'WEB MANUAL' ? 'Web · manual' : 'Web · alocação'}</Badge>
          : <Badge variant="outline">Delphi</Badge>;
      case 'numero_entrada':
        return <span className="font-medium">{row.numero_entrada}</span>;
      case 'fornecedor':
        return <span className="truncate max-w-[200px] inline-block">{row.fornecedor || '-'}</span>;
      case 'total_itens':
        return row.total_itens;
      case 'qtd_total_devolucao':
        return fmtQtd(row.qtd_total_devolucao);
      default:
        return (row as any)[header.key] || '-';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-10 pt-4 pb-1 flex-shrink-0">
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            Devoluções de compra
          </div>
          {onNova && (
            <DefaultButton text="Nova devolução" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onNova} />
          )}
        </div>
        {abertasWeb > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter('ABERTA')}
            className="mb-1 w-full text-left text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700 px-3 py-2"
          >
            {abertasWeb} devoluç{abertasWeb === 1 ? 'ão' : 'ões'} aguardando emissão da NF.
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full pb-6 overflow-hidden">
          <main className="px-4 w-full h-full">
            <div
              className="border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded-lg flex flex-col w-full overflow-hidden"
              style={{ height: 'calc(100vh - 200px)', maxWidth: '100%' }}
            >
              {/* Search + Filtro */}
              <div className="border-b border-gray-200 dark:border-zinc-700 p-2">
                <div className="flex justify-between items-center gap-2">
                  <SearchInput
                    placeholder="Pesquisar por entrada, fornecedor, NFe..."
                    onChange={handleSearch}
                    onKeyDown={handleSearchKeyDown}
                    onBlur={handleSearchBlur}
                  />
                  <div className="w-[180px] flex-shrink-0">
                    <SelectInput
                      name="statusFilter"
                      label=""
                      value={statusFilter}
                      options={STATUS_FILTER_OPTIONS}
                      onValueChange={(val) => setStatusFilter(val)}
                    />
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="w-full overflow-x-auto overflow-y-auto flex-1">
                  <div className="min-w-full">
                    <table className="table-auto w-full border-collapse text-sm text-center">
                      <thead className="sticky top-0 z-10 border-b border-gray-300 dark:border-zinc-700">
                        <tr>
                          {HEADERS.map((header) => (
                            <th
                              key={header.key}
                              className={`relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center ${
                                header.fixed ? 'w-[80px]' : 'min-w-[140px]'
                              }`}
                            >
                              <div className="flex justify-center">
                                {header.label}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={HEADERS.length}>
                              <div className="flex justify-center items-center py-20">
                                <Carregamento texto="BUSCANDO DADOS" />
                              </div>
                            </td>
                          </tr>
                        ) : data.length === 0 ? (
                          <tr>
                            <td colSpan={HEADERS.length} className="py-20 text-center">
                              Nenhuma devolução neste filtro.
                            </td>
                          </tr>
                        ) : (
                          data.map((row, rowIndex) => (
                            <tr
                              key={row.id || rowIndex}
                              className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
                              onClick={() => onVerDetalhe(row.id)}
                            >
                              {HEADERS.map((header) => (
                                <td
                                  key={header.key}
                                  className="border-t border-gray-300 dark:border-zinc-600 px-4 py-2 whitespace-nowrap"
                                  onClick={header.key === 'acoes' ? (e) => e.stopPropagation() : undefined}
                                >
                                  <div className="truncate">
                                    {renderCell(header, row)}
                                  </div>
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

              {/* Rodapé/Paginação */}
              <div className="flex-shrink-0 border-t border-gray-300 dark:border-zinc-500 bg-gray-200 dark:bg-zinc-800 px-2 py-2 min-h-[3rem]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">Qtd. Itens:</span>
                      <SelectInput
                        required
                        name="itemsPagina"
                        label=""
                        value={perPage.toString()}
                        options={PER_PAGE_OPTIONS}
                        onValueChange={(val) => setPerPage(parseInt(val))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center text-sm">
                    <button
                      onClick={() => { if (pagination.page > 1) fetchData(pagination.page - 1, searchTerm, statusFilter); }}
                      disabled={pagination.page <= 1}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="whitespace-nowrap">
                      Página {pagination.page} de {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => { if (pagination.page < pagination.totalPages) fetchData(pagination.page + 1, searchTerm, statusFilter); }}
                      disabled={pagination.page >= pagination.totalPages}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

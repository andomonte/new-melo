/**
 * Lista de Declarações de Importação (DIs)
 * Layout e tabela idênticos ao DataTableFiltroV3 + ComprasTabManager
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import Carregamento from '@/utils/carregamento';
import SearchInput from '@/components/common/SearchInput2';
import SelectInput from '@/components/common/SelectInput2';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import api from '@/components/services/api';

interface ImportacaoListProps {
  onNovaImportacao: () => void;
  onVerDetalhe: (id: number) => void;
  refreshKey?: number;
}

interface ImportacaoRow {
  id: number;
  nro_di: string;
  data_di: string;
  status: 'N' | 'E' | 'C';
  taxa_dolar: number;
  total_mercadoria: number;
  total_cif: number;
  navio?: string;
  qtd_adicoes?: number;
  codusr?: string;
  data_cad?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  N: { label: 'Nova', variant: 'secondary' },
  E: { label: 'Entrada Gerada', variant: 'default' },
  C: { label: 'Cancelada', variant: 'destructive' },
};

const HEADERS = [
  { key: 'acoes', label: 'Ações', fixed: true },
  { key: 'nro_di', label: 'Nº DI', fixed: false },
  { key: 'data_di', label: 'Data', fixed: false },
  { key: 'status', label: 'Status', fixed: false },
  { key: 'qtd_adicoes', label: 'Adições', fixed: false },
  { key: 'navio', label: 'Navio', fixed: false },
  { key: 'total_mercadoria', label: 'Total (USD)', fixed: false },
  { key: 'taxa_dolar', label: 'Taxa Dólar', fixed: false },
  { key: 'total_cif', label: 'Total CIF', fixed: false },
];

const PER_PAGE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

export const ImportacaoList: React.FC<ImportacaoListProps> = ({
  onNovaImportacao,
  onVerDetalhe,
  refreshKey,
}) => {
  const [data, setData] = useState<ImportacaoRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [perPage, setPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ImportacaoRow | null>(null);

  const fetchData = useCallback(async (page = 1, busca = '') => {
    setLoading(true);
    try {
      const response = await api.get('/api/importacao/list', {
        params: { page, limit: perPage, busca: busca || undefined },
      });
      if (response.data?.success) {
        setData(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      }
    } catch (err) {
      console.error('Erro ao carregar importações:', err);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => {
    fetchData(1, searchTerm);
  }, [refreshKey, perPage]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') fetchData(1, searchTerm);
  };

  const handleSearchBlur = () => {
    fetchData(1, searchTerm);
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      const response = await api.delete(`/api/importacao/delete?id=${confirmDelete.id}`);
      if (response.data?.success) {
        setConfirmDelete(null);
        fetchData(pagination.page, searchTerm);
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setDeleting(null);
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const fmtUSD = (v: number) =>
    `$ ${(parseFloat(String(v)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtTaxa = (v: number) =>
    `R$ ${(parseFloat(String(v)) || 0).toFixed(4)}`;

  const renderCell = (header: typeof HEADERS[number], row: ImportacaoRow) => {
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
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDelete(row)}
                className="text-red-600 dark:text-red-400 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir (somente teste)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case 'status': {
        const info = STATUS_MAP[row.status] || { label: row.status, variant: 'secondary' as const };
        return <Badge variant={info.variant}>{info.label}</Badge>;
      }
      case 'data_di':
        return fmtDate(row.data_di);
      case 'total_mercadoria':
        return <span className="text-green-600 dark:text-green-400 font-medium">{fmtUSD(row.total_mercadoria)}</span>;
      case 'total_cif':
        return <span className="font-medium">{fmtUSD(row.total_cif)}</span>;
      case 'taxa_dolar':
        return fmtTaxa(row.taxa_dolar);
      case 'qtd_adicoes':
        return row.qtd_adicoes || '-';
      case 'navio':
        return row.navio || '-';
      case 'nro_di':
        return <span className="font-medium">{row.nro_di}</span>;
      default:
        return (row as any)[header.key] || '-';
    }
  };

  return (
    <>
    <ConfirmationModal
      isOpen={!!confirmDelete}
      onClose={() => setConfirmDelete(null)}
      onConfirm={handleExcluir}
      title="Excluir Importação (somente teste)"
      message={`Deseja excluir a DI ${confirmDelete?.nro_di}?\n\nEsta ação irá remover a importação e todos os dados relacionados (contratos, entradas, itens).`}
      type="danger"
      confirmText="Sim, Excluir"
      cancelText="Cancelar"
      loading={deleting !== null}
    />
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header - igual ComprasTabManager: px-10 pt-4 pb-1 */}
      <div className="px-10 pt-4 pb-1 flex-shrink-0">
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            Declarações de Importação
          </div>
          <Button
            onClick={onNovaImportacao}
            className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            <Plus size={18} />
            Nova Importação
          </Button>
        </div>
      </div>

      {/* Conteúdo - igual RequisicoesCompraMain: flex-1 min-h-0 overflow-hidden > px-4 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full pb-6 overflow-hidden">
          <main className="px-4 w-full h-full">
            {/* DataTable container - EXATO igual DataTableFiltroV3 linha 255 */}
            <div
              className="border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded-lg flex flex-col w-full overflow-hidden"
              style={{ height: 'calc(100vh - 200px)', maxWidth: '100%' }}
            >
              {/* Search - border-b p-2 */}
              <div className="border-b border-gray-200 dark:border-zinc-700 p-2">
                <div className="flex justify-between items-center gap-2">
                  <SearchInput
                    placeholder="Pesquisar por nº DI, navio..."
                    onChange={handleSearch}
                    onKeyDown={handleSearchKeyDown}
                    onBlur={handleSearchBlur}
                  />
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
                              Sem dados até o momento.
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

              {/* Rodapé/Paginação - EXATO igual DataTableFiltroV3 linha 647 */}
              <div className="flex-shrink-0 border-t border-gray-300 dark:border-zinc-500 bg-gray-200 dark:bg-zinc-800 px-2 py-2 min-h-[3rem]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">Qtd. Itens:</span>
                      <SelectInput
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
                      onClick={() => { if (pagination.page > 1) fetchData(pagination.page - 1, searchTerm); }}
                      disabled={pagination.page <= 1}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="whitespace-nowrap">
                      Página {pagination.page} de {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => { if (pagination.page < pagination.totalPages) fetchData(pagination.page + 1, searchTerm); }}
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
    </>
  );
};

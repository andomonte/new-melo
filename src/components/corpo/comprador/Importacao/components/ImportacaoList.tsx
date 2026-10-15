/**
 * Lista de Declarações de Importação (DIs) — padrão DataTablePadrao (igual aos
 * cadastros, ex.: clientes): busca, filtros por coluna e filtro de STATUS por
 * dropdown (Nova / Nota Emitida / Entrada Gerada / Cancelada).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import DataTable from '@/components/common/DataTablePadrao';
import type { Meta } from '@/data/common/meta';
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
  /** DI já tem nota de nacionalização emitida (dbfatura + dbfat_nfe autorizada). */
  nota_emitida?: boolean;
  nfe_numero?: string | null;
  nfe_chave?: string | null;
  taxa_dolar: number;
  total_mercadoria: number;
  total_cif: number;
  navio?: string;
  qtd_adicoes?: number;
}

// Colunas: a CHAVE é o header (casa com a coluna do backend para os filtros); o
// rótulo visível vem de COLUMN_LABELS. 'acoes' e 'status' não têm filtro de texto
// (status usa o dropdown dedicado).
const HEADERS = ['acoes', 'nro_di', 'data_di', 'status', 'qtd_adicoes', 'navio', 'total_mercadoria', 'taxa_dolar', 'total_cif'];
const COLUMN_LABELS: Record<string, string> = {
  acoes: 'Ações',
  nro_di: 'Nº DI',
  data_di: 'Data',
  status: 'Status',
  qtd_adicoes: 'Adições',
  navio: 'Navio',
  total_mercadoria: 'Total (USD)',
  taxa_dolar: 'Taxa Dólar',
  total_cif: 'Total CIF',
};
// Colunas no seletor de colunas (rótulos via COLUMN_LABELS).
const COLUNAS_CHOOSER = ['nro_di', 'data_di', 'status', 'qtd_adicoes', 'navio', 'total_mercadoria', 'taxa_dolar', 'total_cif'];
// Colunas SEM input de texto na linha de filtros (status usa o dropdown; numéricas não filtram).
const COLUNAS_SEM_FILTRO = ['status', 'qtd_adicoes', 'total_mercadoria', 'taxa_dolar', 'total_cif'];
// Campos realmente filtráveis no backend (whitelist de envio).
const CAMPOS_FILTRAVEIS = ['nro_di', 'navio', 'data_di'];
const STATUS_OPTIONS = [
  { value: 'N', label: 'Nova' },
  { value: 'EMITIDA', label: 'Nota Emitida' },
  { value: 'E', label: 'Entrada Gerada' },
  { value: 'C', label: 'Cancelada' },
];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  N: { label: 'Nova', variant: 'secondary' },
  E: { label: 'Entrada Gerada', variant: 'default' },
  C: { label: 'Cancelada', variant: 'destructive' },
};

const fmtDate = (d: string) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
};
const fmtUSD = (v: number) =>
  `$ ${(parseFloat(String(v)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTaxa = (v: number) => `R$ ${(parseFloat(String(v)) || 0).toFixed(4)}`;

export const ImportacaoList: React.FC<ImportacaoListProps> = ({
  onNovaImportacao,
  onVerDetalhe,
  refreshKey,
}) => {
  const [data, setData] = useState<ImportacaoRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, lastPage: 1, currentPage: 1, perPage: 25 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [buscaCommit, setBuscaCommit] = useState(''); // busca aplicada (Enter/blur)
  const [search, setSearch] = useState(''); // valor digitado
  const [statusFiltro, setStatusFiltro] = useState('todas'); // todas | N | EMITIDA | E | C
  const [filtros, setFiltros] = useState<{ campo: string; tipo: string; valor: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ImportacaoRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: perPage };
      if (buscaCommit) params.busca = buscaCommit;
      // Status (dropdown): 'EMITIDA' = status N + nota autorizada (com_nota).
      if (statusFiltro && statusFiltro !== 'todas') {
        if (statusFiltro === 'EMITIDA') { params.status = 'N'; params.com_nota = '1'; }
        else params.status = statusFiltro;
      }
      // Filtros por coluna (campo = chave = coluna do backend; whitelist no backend).
      const filtrosValidos = filtros.filter((f) => CAMPOS_FILTRAVEIS.includes(f.campo) && f.valor);
      if (filtrosValidos.length) params.filtros = JSON.stringify(filtrosValidos);

      const resp = await api.get('/api/importacao/list', { params });
      if (resp.data?.success) {
        setData(resp.data.data || []);
        const p = resp.data.pagination || {};
        setMeta({
          total: p.total || 0,
          lastPage: p.totalPages || 1,
          currentPage: p.page || 1,
          perPage: p.limit || perPage,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar importações:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, buscaCommit, statusFiltro, filtros]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      const response = await api.delete(`/api/importacao/delete?id=${confirmDelete.id}`);
      if (response.data?.success) {
        setConfirmDelete(null);
        fetchData();
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setDeleting(null);
    }
  };

  const statusCell = (row: ImportacaoRow) => {
    if (row.status === 'N' && row.nota_emitida) {
      const tip = [row.nfe_numero ? `NF ${row.nfe_numero}` : '', row.nfe_chave || ''].filter(Boolean).join(' · ');
      return (
        <Badge title={tip || 'Nota de nacionalização emitida'} className="bg-blue-600 hover:bg-blue-600 text-white border-transparent">
          Nota Emitida
        </Badge>
      );
    }
    const info = STATUS_MAP[row.status] || { label: row.status, variant: 'secondary' as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  // Linhas no formato do DataTablePadrao: objeto keyado pelo header, valor = JSX/primitivo.
  const rows = data.map((row) => ({
    id: row.id,
    acoes: (
      <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" type="button">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onVerDetalhe(row.id)}>
              <Eye className="mr-2 h-4 w-4" /> Ver
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDelete(row)}
              className="text-red-600 dark:text-red-400 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir (somente teste)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    nro_di: <span className="font-medium">{row.nro_di}</span>,
    data_di: fmtDate(row.data_di),
    status: statusCell(row),
    qtd_adicoes: row.qtd_adicoes || '-',
    navio: row.navio || '-',
    total_mercadoria: <span className="text-green-600 dark:text-green-400 font-medium">{fmtUSD(row.total_mercadoria)}</span>,
    taxa_dolar: fmtTaxa(row.taxa_dolar),
    total_cif: <span className="font-medium">{fmtUSD(row.total_cif)}</span>,
  }));

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
        <div className="px-6 pt-4 pb-1 flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">Declarações de Importação</div>
            <Button
              onClick={onNovaImportacao}
              className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              <Plus size={18} /> Nova Importação
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          <DataTable
            headers={HEADERS}
            columnLabels={COLUMN_LABELS}
            rows={rows}
            meta={meta}
            carregando={loading}
            semColunaDeAcaoPadrao
            nonsortableColumns={HEADERS}
            onRowClick={(r) => { if (r?.id) onVerDetalhe(r.id); }}
            onPageChange={setPage}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(1); }}
            onSearch={(e) => setSearch(e.target.value)}
            onSearchKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setBuscaCommit(search); } }}
            onSearchBlur={() => { setPage(1); setBuscaCommit(search); }}
            searchInputPlaceholder="Pesquisar por nº DI, navio..."
            noDataMessage="Nenhuma declaração de importação encontrada."
            colunasFiltro={COLUNAS_CHOOSER}
            colunasSemFiltro={COLUNAS_SEM_FILTRO}
            onFiltroChange={(novos) => { setPage(1); setBuscaCommit(''); setSearch(''); setFiltros(novos); }}
            statusFilterColumn="status"
            statusFilterOptions={STATUS_OPTIONS}
            statusFilterValue={statusFiltro}
            onStatusFilterChange={(v) => { setPage(1); setStatusFiltro(v); }}
          />
        </div>
      </div>
    </>
  );
};

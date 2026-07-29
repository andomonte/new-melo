/**
 * Tela principal de Entradas de Mercadorias
 * Grid padrão (DataTablePadrao) + navegação por teclado (setas, Enter, atalhos).
 */

import React, { useState, useEffect, useContext } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { AuthContext } from '@/contexts/authContexts';
import SelectPadrao from '@/components/common/SelectPadrao';
import DataTablePadrao from '@/components/common/DataTablePadrao';
import { useNavegacaoTecladoTabela, CLASSE_LINHA_ATIVA } from '@/hooks/useNavegacaoTecladoTabela';

// Componentes
import { EntradasHeader } from './EntradasHeader';
import { EntradaOperacoesMenu } from './EntradaOperacoesMenu';
import { EntradasModals } from './EntradasModals';

// Hooks
import { useEntradas } from '../hooks/useEntradas';
import { useEntradasTableImproved } from '../hooks/useEntradasTableImproved';
import { useEntradasActions } from '../hooks/useEntradasActions';

// Types e Config
import { EntradaDTO } from '../types';
import {
  colunasDbEntrada,
  colunasIniciaisEntrada,
  statusEntradaConfig,
  tipoEntradaConfig,
} from '../colunasDbEntrada';
import { formatCurrency, formatDate } from '../helpers';

export const EntradasMain: React.FC = () => {
  // Estados de modais
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isGerarOpen, setIsGerarOpen] = useState(false);
  const [editItem, setEditItem] = useState<EntradaDTO | null>(null);
  const [viewItem, setViewItem] = useState<EntradaDTO | null>(null);
  const [itensItem, setItensItem] = useState<EntradaDTO | null>(null);
  // Ids das linhas cujo menu "Ações" tem algum modal aberto (pausa a navegação).
  const [menusComModal, setMenusComModal] = useState<Set<string>>(new Set());

  const handleOperacaoAtiva = React.useCallback((id: string, ativa: boolean) => {
    setMenusComModal((prev) => {
      if (ativa === prev.has(id)) return prev; // sem mudança → evita re-render/loop
      const next = new Set(prev);
      if (ativa) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const { canEdit: canManageEntradas } = usePermissions();
  const { user } = useContext(AuthContext);

  // Hook de tabela
  const {
    search,
    page,
    perPage,
    headers,
    filtros,
    handleSearchChange,
    handleSearchBlur,
    handleSearchKeyDown,
    handlePageChange,
    handlePerPageChange,
    handleFiltroChange,
    handleColunaSubstituida,
  } = useEntradasTableImproved({
    colunasIniciais: colunasIniciaisEntrada,
    limiteColunas: 9,
  });

  // Filtro rápido por status (dropdown) — vai como `status` (match exato no backend)
  const [statusFiltro, setStatusFiltro] = useState('');

  const filters = React.useMemo(() => ({
    search,
    filtrosColuna: filtros,
    status: statusFiltro || undefined,
  }), [search, filtros, statusFiltro]);

  const { data, meta, loading, refetch } = useEntradas({ page, perPage, search, filters });
  const { loading: actionLoading } = useEntradasActions();

  // Handlers de abertura de modais
  const handleView = (item: EntradaDTO) => setViewItem(item);
  const handleViewItems = (item: EntradaDTO) => setItensItem(item);

  const handleCreateSuccess = async () => { setIsNewOpen(false); await refetch(); };
  const handleGerarSuccess = async () => { setIsGerarOpen(false); await refetch(); };
  const handleEditSuccess = async () => { setEditItem(null); await refetch(); };

  // ⌨️ Navegação por teclado (estilo Delphi): ↑/↓ move a linha; Enter e V abrem
  // Visualizar; I abre Ver Itens. (As demais operações ficam no menu "Ações".)
  const algumModalAberto =
    isNewOpen || isGerarOpen || !!editItem || !!viewItem || !!itensItem || menusComModal.size > 0;

  const { linhaSelecionada, setLinhaSelecionada } = useNavegacaoTecladoTabela<EntradaDTO>({
    data,
    ativo: !algumModalAberto,
    onEnter: (row) => handleView(row),
    atalhos: [
      { key: 'v', handler: (row) => row && handleView(row) },
      { key: 'i', handler: (row) => row && handleViewItems(row) },
    ],
  });

  // Esc fecha o modal aberto no topo (inclui os abertos pelos atalhos).
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (itensItem) setItensItem(null);
      else if (viewItem) setViewItem(null);
      else if (editItem) setEditItem(null);
      else if (isGerarOpen) setIsGerarOpen(false);
      else if (isNewOpen) setIsNewOpen(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [itensItem, viewItem, editItem, isGerarOpen, isNewOpen]);

  // Rótulos e célula por coluna
  const columnLabels = React.useMemo(
    () => colunasDbEntrada.reduce((acc, c) => { acc[c.campo] = c.label; return acc; },
      {} as Record<string, string>),
    [],
  );

  const renderCell = (entrada: EntradaDTO, campo: string): React.ReactNode => {
    switch (campo) {
      case 'acoes':
        return (
          <EntradaOperacoesMenu
            entrada={{
              id: entrada.id,
              numeroNF: entrada.numeroNF,
              numeroEntrada: entrada.numeroEntrada,
              status: entrada.status,
              temRomaneio: entrada.temRomaneio,
              precoConfirmado: entrada.precoConfirmado,
            }}
            onView={() => handleView(entrada)}
            onViewItems={() => handleViewItems(entrada)}
            onRefresh={refetch}
            onOperacaoAtiva={(ativa) => handleOperacaoAtiva(entrada.id, ativa)}
          />
        );
      case 'status': {
        const cfg = statusEntradaConfig[entrada.status] || { label: entrada.status || 'N/A', color: 'text-gray-600 bg-gray-50' };
        return <span className={`px-2 py-1 text-xs rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>;
      }
      case 'tipoEntrada': {
        const cfg = tipoEntradaConfig[entrada.tipoEntrada] || { label: entrada.tipoEntrada, color: 'bg-gray-100 text-gray-800' };
        return <span className={`px-2 py-1 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
      }
      case 'valorTotal':
      case 'valorProdutos':
        return formatCurrency((entrada as any)[campo] as number);
      case 'dataEmissao':
      case 'dataEntrada':
        return formatDate((entrada as any)[campo] as string);
      case 'temRomaneio':
        return entrada.temRomaneio
          ? <span className="px-2 py-1 text-xs rounded-full font-semibold text-blue-700 bg-blue-100">Gerado</span>
          : <span className="px-2 py-1 text-xs rounded-full font-semibold text-gray-500 bg-gray-100">Não gerado</span>;
      case 'precoConfirmado':
        return entrada.precoConfirmado
          ? <span className="px-2 py-1 text-xs rounded-full font-semibold text-purple-700 bg-purple-100">Confirmado</span>
          : <span className="px-2 py-1 text-xs rounded-full font-semibold text-gray-500 bg-gray-100">Pendente</span>;
      default:
        return (entrada as any)[campo] || '-';
    }
  };

  const rows = React.useMemo(
    () => data.map((entrada, index) => {
      const row: Record<string, any> = { __index: index };
      headers.forEach((h) => { row[h] = renderCell(entrada, h); });
      return row;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, headers],
  );

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900 overflow-hidden">
      {/* Cabecalho */}
      <EntradasHeader
        onRefresh={refetch}
        onNovaEntrada={() => setIsNewOpen(true)}
        onGerarEntrada={() => setIsGerarOpen(true)}
        canManageEntradas={canManageEntradas}
      />

      {/* Grid padrão */}
      <div className="flex-1 min-h-0 min-w-0 px-6 pb-4 flex flex-col overflow-hidden">
        <DataTablePadrao
          screenKey="entradas-mercadorias"
          userName={user?.usuario}
          headers={headers}
          rows={rows}
          meta={{ ...meta, currentPage: page }}
          carregando={loading}
          semColunaDeAcaoPadrao
          persistPerPage={false}
          searchValue={search}
          onSearch={handleSearchChange}
          onSearchBlur={handleSearchBlur}
          onSearchKeyDown={handleSearchKeyDown}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onFiltroChange={handleFiltroChange}
          onColunaSubstituida={handleColunaSubstituida}
          colunasFiltro={colunasDbEntrada.map((c) => c.campo)}
          sortableColumns={['__sem_ordenacao__']}
          nonsortableColumns={['acoes', 'AÇÕES']}
          mostrarFiltrosSempre
          searchInputPlaceholder="Buscar por NF, entrada, fornecedor..."
          columnLabels={{ ...columnLabels, acoes: 'Ações' }}
          rowClassName={(row) =>
            (row as any).__index === linhaSelecionada
              ? `bg-blue-100 dark:bg-blue-900/50 ${CLASSE_LINHA_ATIVA}`
              : ''
          }
          onRowClick={(row) => setLinhaSelecionada((row as any).__index ?? -1)}
          searchRightSlot={
            <div className="w-44 shrink-0">
              <SelectPadrao
                placeholder="Todos os status"
                value={statusFiltro || 'todos'}
                onValueChange={(v) => {
                  setStatusFiltro(v === 'todos' ? '' : v);
                  handlePageChange(1);
                }}
                options={[
                  { value: 'todos', label: 'Todos os status' },
                  { value: 'A', label: 'Aberta' },
                  { value: 'F', label: 'Finalizada' },
                  { value: 'C', label: 'Cancelada' },
                  { value: 'PENDENTE', label: 'Pendente' },
                  { value: 'PRECO_CONFIRMADO', label: 'Preço Confirmado' },
                  { value: 'AGUARDANDO_RECEBIMENTO', label: 'Aguardando Recebimento' },
                  { value: 'RECEBIDO', label: 'Recebido' },
                  { value: 'ALOCADO', label: 'Alocado' },
                  { value: 'DISPONIVEL_VENDA', label: 'Disponível p/ Venda' },
                  { value: 'CANCELADA', label: 'Cancelada (novo)' },
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Modais */}
      <EntradasModals
        isNewOpen={isNewOpen}
        onNewClose={() => setIsNewOpen(false)}
        onNewSuccess={handleCreateSuccess}
        isGerarOpen={isGerarOpen}
        onGerarClose={() => setIsGerarOpen(false)}
        onGerarSuccess={handleGerarSuccess}
        actionLoading={actionLoading}
        editItem={editItem}
        onEditClose={() => setEditItem(null)}
        onEditSuccess={handleEditSuccess}
        viewItem={viewItem}
        onViewClose={() => setViewItem(null)}
        itensItem={itensItem}
        onItensClose={() => setItensItem(null)}
      />
    </div>
  );
};

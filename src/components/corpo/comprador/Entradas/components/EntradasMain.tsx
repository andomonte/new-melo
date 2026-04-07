/**
 * Tela principal de Entradas de Mercadorias
 * Componente orquestrador que usa subcomponentes modularizados
 */

import React, { useState, useRef } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

// Componentes
import { EntradasHeader } from './EntradasHeader';
import { EntradasFilters } from './EntradasFilters';
import { EntradasTableContent } from './EntradasTableContent';
import { EntradasPagination } from './EntradasPagination';
import { EntradasModals } from './EntradasModals';

// Hooks
import { useEntradas } from '../hooks/useEntradas';
import { useEntradasTableImproved } from '../hooks/useEntradasTableImproved';
import { useEntradasActions } from '../hooks/useEntradasActions';

// Types e Config
import { EntradaDTO } from '../types';
import { colunasIniciaisEntrada } from '../colunasDbEntrada';

export const EntradasMain: React.FC = () => {
  // Estados de modais
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isGerarOpen, setIsGerarOpen] = useState(false);
  const [editItem, setEditItem] = useState<EntradaDTO | null>(null);
  const [viewItem, setViewItem] = useState<EntradaDTO | null>(null);
  const [itensItem, setItensItem] = useState<EntradaDTO | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { canEdit: canManageEntradas } = usePermissions();

  // Hook de tabela
  const {
    search,
    page,
    perPage,
    headers,
    filtros,
    limiteColunas,
    // Filtros rapidos
    mostrarFiltrosRapidos,
    filtrosColuna,
    handleSearchChange,
    handleSearchBlur,
    handleSearchKeyDown,
    handlePageChange,
    handlePerPageChange,
    handleFiltroChange,
    handleColunaSubstituida,
    handleLimiteColunasChange,
    // Handlers filtros rapidos
    handleFiltroRapidoChange,
    handleToggleFiltrosRapidos,
    aplicarFiltrosRapidos,
    handleTipoFiltroRapidoChange,
  } = useEntradasTableImproved({
    colunasIniciais: colunasIniciaisEntrada,
    limiteColunas: 9,
  });

  // Hook de dados - incluir filtros dinamicos por coluna
  const filters = React.useMemo(() => ({
    search,
    filtrosColuna: filtros,
  }), [search, filtros]);

  const { data, meta, loading, refetch } = useEntradas({
    page,
    perPage,
    search,
    filters,
  });

  // Hook de acoes
  const { loading: actionLoading } = useEntradasActions();

  // Handlers
  const handleView = (item: EntradaDTO) => {
    setViewItem(item);
  };

  const handleViewItems = (item: EntradaDTO) => {
    setItensItem(item);
  };

  const handleCreateSuccess = async () => {
    setIsNewOpen(false);
    await refetch();
  };

  const handleGerarSuccess = async () => {
    setIsGerarOpen(false);
    await refetch();
  };

  const handleEditSuccess = async () => {
    setEditItem(null);
    await refetch();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Cabecalho */}
      <EntradasHeader
        onRefresh={refetch}
        onNovaEntrada={() => setIsNewOpen(true)}
        onGerarEntrada={() => setIsGerarOpen(true)}
        canManageEntradas={canManageEntradas}
      />

      {/* Container da Tabela */}
      <div className="flex-1 px-6 pb-4 overflow-hidden">
        <div
          ref={containerRef}
          className="border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded-lg flex flex-col w-full overflow-hidden h-full"
        >
          {/* Filtros e Busca */}
          <EntradasFilters
            search={search}
            headers={headers}
            filtros={filtros}
            mostrarFiltrosRapidos={mostrarFiltrosRapidos}
            onSearchChange={handleSearchChange}
            onSearchKeyDown={handleSearchKeyDown}
            onSearchBlur={handleSearchBlur}
            onFiltroChange={handleFiltroChange}
            onToggleFiltrosRapidos={handleToggleFiltrosRapidos}
          />

          {/* Tabela */}
          <EntradasTableContent
            headers={headers}
            data={data}
            loading={loading}
            mostrarFiltrosRapidos={mostrarFiltrosRapidos}
            filtrosColuna={filtrosColuna}
            onView={handleView}
            onViewItems={handleViewItems}
            onRefresh={refetch}
            onColunaSubstituida={handleColunaSubstituida}
            onFiltroRapidoChange={handleFiltroRapidoChange}
            onAplicarFiltrosRapidos={aplicarFiltrosRapidos}
            onTipoFiltroRapidoChange={handleTipoFiltroRapidoChange}
          />

          {/* Paginacao */}
          <EntradasPagination
            page={page}
            perPage={perPage}
            lastPage={meta?.lastPage || 1}
            limiteColunas={limiteColunas}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
            onLimiteColunasChange={handleLimiteColunasChange}
          />
        </div>
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

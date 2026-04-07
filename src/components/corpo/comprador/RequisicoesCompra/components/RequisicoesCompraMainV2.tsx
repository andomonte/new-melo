// Componente principal das requisições seguindo o padrão do sistema
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequisitionDTO, RequisitionStatus, RequisitionFilters } from '@/types/compras';
import RequisitionsTable from '../List/RequisitionsTableV3';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';
import EditRequisitionModal from '../Form/EditRequisitionModal';
import { RequisitionItemsManager } from './RequisitionItemsManagerV3';
import api from '@/components/services/api';

interface Meta {
  total: number;
  lastPage: number;
  currentPage: number;
  perPage: number;
}

export const RequisicoesCompraMain: React.FC = () => {
  // Estados principais
  const [data, setData] = useState<RequisitionDTO[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    lastPage: 1,
    currentPage: 1,
    perPage: 25
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<RequisitionFilters>({
    page: 1,
    limit: 25
  });

  // Estados de modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<RequisitionDTO | null>(null);
  const [managingItemsRequisition, setManagingItemsRequisition] = useState<RequisitionDTO | null>(null);

  // Carregar dados
  const fetchData = async (newFilters?: Partial<RequisitionFilters>) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = { ...filters, ...newFilters };
      
      const params = new URLSearchParams();
      if (currentFilters.page) params.append('page', currentFilters.page.toString());
      if (currentFilters.limit) params.append('limit', currentFilters.limit.toString());
      if (searchTerm) params.append('search', searchTerm);
      if (currentFilters.status?.length) {
        currentFilters.status.forEach(status => params.append('status[]', status));
      }
      if (currentFilters.fornecedor) params.append('fornecedor', currentFilters.fornecedor);
      if (currentFilters.comprador) params.append('comprador', currentFilters.comprador);
      if (currentFilters.dataInicio) params.append('dataInicio', currentFilters.dataInicio);
      if (currentFilters.dataFim) params.append('dataFim', currentFilters.dataFim);

      const response = await api.get(`/api/requisicoesCompra/list?${params.toString()}`);

      if (response.data?.success) {
        setData(response.data.data || []);
        setMeta({
          total: response.data.total || 0,
          lastPage: Math.ceil((response.data.total || 0) / currentFilters.limit!),
          currentPage: currentFilters.page || 1,
          perPage: currentFilters.limit || 25
        });
      } else {
        throw new Error(response.data?.message || 'Erro ao carregar dados');
      }
    } catch (error) {
      console.error('Erro ao carregar requisições:', error);
      setError('Erro ao carregar requisições. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    fetchData();
  }, []);

  // Handlers de paginação
  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const handlePerPageChange = (perPage: number) => {
    const newFilters = { ...filters, limit: perPage, page: 1 };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  // Handler de busca
  const handleSearch = () => {
    const newFilters = { ...filters, page: 1 };
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handlers de ações
  const handleNewRequisition = () => {
    setIsNewModalOpen(true);
  };

  const handleEdit = (requisition: RequisitionDTO) => {
    setEditingRequisition(requisition);
  };

  const handleView = (requisition: RequisitionDTO) => {
    // TODO: Implementar modal de visualização
    console.log('Visualizar requisição:', requisition);
  };

  const handleManageItems = (requisition: RequisitionDTO) => {
    setManagingItemsRequisition(requisition);
  };

  const handleStatusChange = async (requisition: RequisitionDTO, newStatus: RequisitionStatus) => {
    try {
      // Atualizar na lista local primeiro (otimistic update)
      setData(prevData => 
        prevData.map(item => 
          item.id === requisition.id 
            ? { ...item, statusRequisicao: newStatus }
            : item
        )
      );

      // Recarregar dados para sincronizar
      await fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // Reverter mudança local em caso de erro
      await fetchData();
    }
  };

  const handleModalSuccess = () => {
    setIsNewModalOpen(false);
    setEditingRequisition(null);
    fetchData(); // Recarregar dados
  };

  const handleRefresh = () => {
    fetchData();
  };

  const handleExport = () => {
    // TODO: Implementar exportação
    console.log('Exportar dados');
  };

  // Se está gerenciando itens, mostrar o componente específico
  if (managingItemsRequisition) {
    return (
      <RequisitionItemsManager
        requisitionId={managingItemsRequisition.id}
        requisitionVersion={managingItemsRequisition.versao}
        requisitionData={managingItemsRequisition}
        onBack={() => setManagingItemsRequisition(null)}
        onStatusChange={(newStatus) => handleStatusChange(managingItemsRequisition, newStatus)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Requisições de Compra
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Gerencie suas requisições existentes. Crie novas requisições, acompanhe o status e gerencie itens do processo de compras.
            </p>
          </div>
          
          <Button
            onClick={handleNewRequisition}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Requisição
          </Button>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
          <div className="flex items-center gap-4">
            {/* Campo de busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Pesquisar por requisição, fornecedor, comprador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 pr-4"
              />
            </div>

            {/* Botões de ação */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSearch}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Buscar
              </Button>

              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <Button
                onClick={handleExport}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Resumo */}
        {!loading && data.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {meta.total} requisição(ões) encontrada(s)
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-700 dark:text-red-200">{error}</div>
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1">
        <RequisitionsTable
          data={data}
          meta={meta}
          loading={loading}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onEdit={handleEdit}
          onView={handleView}
          onManageItems={handleManageItems}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Modais */}
      {isNewModalOpen && (
        <NovaRequisicaoModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingRequisition && (
        <EditRequisitionModal
          isOpen={!!editingRequisition}
          onClose={() => setEditingRequisition(null)}
          onSuccess={handleModalSuccess}
          requisition={editingRequisition}
        />
      )}
    </div>
  );
};
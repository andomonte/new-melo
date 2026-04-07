// Componente principal das requisições - versão corrigida
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { Plus, Search, RefreshCw, Download, Send, CheckCircle, XCircle, Trash2, Settings, Package, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequisitionDTO, RequisitionStatus, RequisitionFilters } from '@/types/compras';
import RequisitionsTable from '../List/RequisitionsTableV3';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';
import EditRequisitionModal from '../Form/EditRequisitionModal';
import { RequisitionItemsManager } from './RequisitionItemsManagerV3';
import { AcoesSistemaModal } from './AcoesSistemaModal';
import { EntregasParciaisModal } from './EntregasParciaisModal';
import { PagamentoAntecipadoModal } from './PagamentoAntecipadoModal';
import { usePermissions } from '@/hooks/usePermissions';
import api from '@/components/services/api';

interface Meta {
  total: number;
  lastPage: number;
  currentPage: number;
  perPage: number;
}

export const RequisicoesCompraMain: React.FC = () => {
  // Hook de permissões
  const permissions = usePermissions();
  const { user } = useContext(AuthContext);

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
  const [acoesSistemaModal, setAcoesSistemaModal] = useState<{
    isOpen: boolean;
    requisicao: RequisitionDTO | null;
  }>({ isOpen: false, requisicao: null });
  const [entregasParciaisModal, setEntregasParciaisModal] = useState<{
    isOpen: boolean;
    item: any | null;
  }>({ isOpen: false, item: null });
  const [pagamentoAntecipadoModal, setPagamentoAntecipadoModal] = useState<{
    isOpen: boolean;
    ordem: any | null;
  }>({ isOpen: false, ordem: null });

  // Estados de seleção
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

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
    console.log('Visualizar requisição:', requisition);
  };

  const handleManageItems = (requisition: RequisitionDTO) => {
    setManagingItemsRequisition(requisition);
  };

  // Novos handlers para as funcionalidades
  const handleAcoesSistema = (requisition: RequisitionDTO) => {
    setAcoesSistemaModal({
      isOpen: true,
      requisicao: requisition
    });
  };

  const handleEntregasParciais = (item: any) => {
    setEntregasParciaisModal({
      isOpen: true,
      item: item
    });
  };

  const handlePagamentoAntecipado = (ordem: any) => {
    setPagamentoAntecipadoModal({
      isOpen: true,
      ordem: ordem
    });
  };

  const handleStatusChange = async (requisition: RequisitionDTO, newStatus: RequisitionStatus) => {
    try {
      setData(prevData => 
        prevData.map(item => 
          item.id === requisition.id 
            ? { ...item, statusRequisicao: newStatus }
            : item
        )
      );

      await fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      await fetchData();
    }
  };

  const handleModalSuccess = () => {
    setIsNewModalOpen(false);
    setEditingRequisition(null);
    fetchData();
  };

  const handleRefresh = () => {
    fetchData();
  };

  const handleExport = () => {
    console.log('Exportar dados');
  };

  // Handlers de seleção
  const handleRowSelect = (selected: boolean, rowData: RequisitionDTO) => {
    const rowId = rowData.id?.toString() || '';
    if (selected) {
      setSelectedRows(prev => [...prev, rowId]);
    } else {
      setSelectedRows(prev => prev.filter(id => id !== rowId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allIds = data.map(item => item.id?.toString() || '').filter(Boolean);
      setSelectedRows(allIds);
    } else {
      setSelectedRows([]);
    }
  };

  // Handlers de ações em lote
  const handleBulkSubmit = async () => {
    if (selectedRows.length === 0) return;

    try {
      setLoading(true);
      for (const rowId of selectedRows) {
        const requisition = data.find(item => item.id?.toString() === rowId);
        if (requisition && requisition.statusRequisicao === 'P') {
          await api.put(`/api/requisicoesCompra/actions/submit`, {
            requisitionId: requisition.id,
            version: requisition.versao,
            userId: user?.codusr,
            userName: user?.usuario,
          });
        }
      }
      setSelectedRows([]);
      await fetchData();
    } catch (error) {
      console.error('Erro ao submeter requisições:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRows.length === 0) return;

    try {
      setLoading(true);
      for (const rowId of selectedRows) {
        const requisition = data.find(item => item.id?.toString() === rowId);
        if (requisition && requisition.statusRequisicao === 'S') {
          await api.put(`/api/requisicoesCompra/actions/approve`, {
            requisitionId: requisition.id,
            version: requisition.versao,
            userId: user?.codusr,
            userName: user?.usuario,
          });
        }
      }
      setSelectedRows([]);
      await fetchData();
    } catch (error) {
      console.error('Erro ao aprovar requisições:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRows.length === 0) return;

    try {
      setLoading(true);
      for (const rowId of selectedRows) {
        const requisition = data.find(item => item.id?.toString() === rowId);
        if (requisition && requisition.statusRequisicao === 'S') {
          await api.put(`/api/requisicoesCompra/actions/reject`, {
            requisitionId: requisition.id,
            version: requisition.versao,
            userId: user?.codusr,
            userName: user?.usuario,
          });
        }
      }
      setSelectedRows([]);
      await fetchData();
    } catch (error) {
      console.error('Erro ao reprovar requisições:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedRows.length === 0) return;

    try {
      setLoading(true);
      for (const rowId of selectedRows) {
        const requisition = data.find(item => item.id?.toString() === rowId);
        if (requisition && ['P', 'S'].includes(requisition.statusRequisicao || '')) {
          await api.put(`/api/requisicoesCompra/actions/cancel`, {
            requisitionId: requisition.id,
            version: requisition.versao,
            userId: user?.codusr,
            userName: user?.usuario,
          });
        }
      }
      setSelectedRows([]);
      await fetchData();
    } catch (error) {
      console.error('Erro ao cancelar requisições:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verificar se ações em lote estão disponíveis
  const getAvailableBulkActions = () => {
    if (selectedRows.length === 0) return [];
    
    const selectedItems = data.filter(item => selectedRows.includes(item.id?.toString() || ''));
    const actions = [];

    // Submeter (apenas requisições Pendentes) - se tem permissão
    if (permissions.canSubmit && selectedItems.some(item => item.statusRequisicao === 'P')) {
      actions.push('submit');
    }

    // Aprovar (apenas requisições Submetidas) - se tem permissão
    if (permissions.canApprove && selectedItems.some(item => item.statusRequisicao === 'S')) {
      actions.push('approve');
    }

    // Reprovar (apenas requisições Submetidas) - se tem permissão
    if (permissions.canReject && selectedItems.some(item => item.statusRequisicao === 'S')) {
      actions.push('reject');
    }

    // Cancelar (requisições Pendentes ou Submetidas) - se tem permissão
    if (permissions.canCancel && selectedItems.some(item => ['P', 'S'].includes(item.statusRequisicao || ''))) {
      actions.push('cancel');
    }

    return actions;
  };

  // Verificar se deve mostrar funcionalidade de seleção
  const shouldShowSelection = permissions.canApprove || permissions.canSubmit;
  
  // Forçar exibição para debug (TEMPORÁRIO)
  const forceShowSelection = true; // REMOVER DEPOIS

  // Debug de permissões (temporário)
  useEffect(() => {
    console.log('🔐 Debug RequisicoesCompraMainV3:', {
      permissions,
      shouldShowSelection,
      forceShowSelection,
      canApprove: permissions.canApprove,
      canSubmit: permissions.canSubmit,
      selectedRowsLength: selectedRows.length,
      component: 'RequisicoesCompraMainV3'
    });
  }, [permissions, shouldShowSelection, selectedRows]);

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

        {/* Ações em Lote */}
        {forceShowSelection && selectedRows.length > 0 && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  {selectedRows.length} requisição(ões) selecionada(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRows([])}
                  className="text-xs"
                >
                  Limpar seleção
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                {getAvailableBulkActions().includes('submit') && (
                  <Button
                    onClick={handleBulkSubmit}
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    disabled={loading}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submeter
                  </Button>
                )}
                
                {getAvailableBulkActions().includes('approve') && (
                  <Button
                    onClick={handleBulkApprove}
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    disabled={loading}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aprovar
                  </Button>
                )}
                
                {getAvailableBulkActions().includes('reject') && (
                  <Button
                    onClick={handleBulkReject}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    disabled={loading}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reprovar
                  </Button>
                )}
                
                {getAvailableBulkActions().includes('cancel') && (
                  <Button
                    onClick={handleBulkCancel}
                    size="sm"
                    variant="outline"
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
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
          selectedRows={forceShowSelection ? selectedRows : undefined}
          onRowSelect={forceShowSelection ? handleRowSelect : undefined}
          onSelectAll={forceShowSelection ? handleSelectAll : undefined}
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

      {/* Modal de Ações do Sistema */}
      {acoesSistemaModal.isOpen && acoesSistemaModal.requisicao && (
        <AcoesSistemaModal
          isOpen={acoesSistemaModal.isOpen}
          onClose={() => setAcoesSistemaModal({ isOpen: false, requisicao: null })}
          requisicao={acoesSistemaModal.requisicao}
          onSuccess={() => {
            fetchData();
            setAcoesSistemaModal({ isOpen: false, requisicao: null });
          }}
        />
      )}

      {/* Modal de Entregas Parciais */}
      {entregasParciaisModal.isOpen && entregasParciaisModal.item && (
        <EntregasParciaisModal
          isOpen={entregasParciaisModal.isOpen}
          onClose={() => setEntregasParciaisModal({ isOpen: false, item: null })}
          item={entregasParciaisModal.item}
          onSuccess={() => {
            fetchData();
            setEntregasParciaisModal({ isOpen: false, item: null });
          }}
        />
      )}

      {/* Modal de Pagamento Antecipado */}
      {pagamentoAntecipadoModal.isOpen && pagamentoAntecipadoModal.ordem && (
        <PagamentoAntecipadoModal
          isOpen={pagamentoAntecipadoModal.isOpen}
          onClose={() => setPagamentoAntecipadoModal({ isOpen: false, ordem: null })}
          ordem={pagamentoAntecipadoModal.ordem}
          onSuccess={() => {
            fetchData();
            setPagamentoAntecipadoModal({ isOpen: false, ordem: null });
          }}
        />
      )}
    </div>
  );
};
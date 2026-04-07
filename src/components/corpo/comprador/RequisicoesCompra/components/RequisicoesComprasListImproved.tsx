import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import DataTableRequisicoes from '@/components/common/DataTableRequisicoes';
import { useRequisicoesTableImproved } from '../hooks/useRequisicoesTableImproved';
import { useRequisitions } from '../hooks/useRequisitions';
import { colunasDbRequisicao } from '../colunasDbRequisicao';
import { RequisitionDTO } from '@/types/compras/requisition';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface RequisicoesComprasListImprovedProps {
  className?: string;
}

export default function RequisicoesComprasListImproved({
  className = '',
}: RequisicoesComprasListImprovedProps) {
  const router = useRouter();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    data: any;
    callback: () => void;
  } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);

  // Hook da tabela
  const {
    search,
    page,
    perPage,
    headers,
    selectedRows,
    filtros,
    limiteColunas,
    handleSearchChange,
    handleSearchKeyDown,
    handleSearchBlur,
    handlePageChange,
    handlePerPageChange,
    handleRowSelect,
    handleSelectAll,
    handleFiltroChange,
    handleColunaSubstituida,
    handleLimiteColunasChange,
    getApiParams,
    resetFiltros,
    resetSelecao,
    getSelectionInfo,
  } = useRequisicoesTableImproved({
    limiteColunas: 8,
    storageKey: 'requisicoes-compras-table',
  });

  // Hook dos dados
  const {
    data: requisitions,
    meta,
    loading,
    error,
    refetch,
  } = useRequisitions(getApiParams());

  // Ações da tabela
  const handleActionClick = useCallback(async (action: string, rowData: RequisitionDTO) => {
    switch (action) {
      case 'ver':
        router.push(`/compras/requisicoes-compra/view/${rowData.id}`);
        break;

      case 'editar':
        router.push(`/compras/requisicoes-compra/edit/${rowData.id}`);
        break;

      case 'itens':
        router.push(`/compras/requisicoes-compra/items/${rowData.id}`);
        break;

      case 'duplicar':
        await handleDuplicarRequisicao(rowData);
        break;

      case 'submeter':
        await handleSubmeterRequisicao(rowData);
        break;

      case 'aprovar':
        await handleAprovarRequisicao(rowData);
        break;

      case 'reprovar':
        showConfirmationDialog('reprovar', rowData, () => handleReprovarRequisicao(rowData));
        break;

      case 'cancelar':
        showConfirmationDialog('cancelar', rowData, () => handleCancelarRequisicao(rowData));
        break;

      case 'excluir':
        showConfirmationDialog('excluir', rowData, () => handleExcluirRequisicao(rowData));
        break;

      default:
        console.warn(`Ação não implementada: ${action}`);
    }
  }, [router]);

  // Mostrar diálogo de confirmação
  const showConfirmationDialog = (type: string, data: any, callback: () => void) => {
    setConfirmAction({ type, data, callback });
    setShowConfirmDialog(true);
    setMotivo('');
  };

  // Confirmar ação
  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setProcessando(true);
    try {
      await confirmAction.callback();
      setShowConfirmDialog(false);
      setConfirmAction(null);
      setMotivo('');
      refetch();
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      toast.error('Erro ao executar ação');
    } finally {
      setProcessando(false);
    }
  };

  // Implementação das ações

  const handleDuplicarRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/${requisicao.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Erro ao duplicar requisição');
      }

      const result = await response.json();
      toast.success('Requisição duplicada com sucesso');
      
      // Redirecionar para edição da nova requisição
      router.push(`/compras/requisicoes-compra/edit/${result.data.id}`);
    } catch (error) {
      toast.error('Erro ao duplicar requisição');
      console.error(error);
    }
  };

  const handleSubmeterRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/actions/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requisicao.id, versao: requisicao.versao }),
      });

      if (!response.ok) {
        throw new Error('Erro ao submeter requisição');
      }

      toast.success('Requisição submetida para aprovação');
      refetch();
    } catch (error) {
      toast.error('Erro ao submeter requisição');
      console.error(error);
    }
  };

  const handleAprovarRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/actions/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requisitionId: requisicao.id, version: requisicao.versao }),
      });

      if (!response.ok) {
        throw new Error('Erro ao aprovar requisição');
      }

      const result = await response.json();
      toast.success(result.message || 'Requisição aprovada com sucesso');
      refetch();
    } catch (error) {
      toast.error('Erro ao aprovar requisição');
      console.error(error);
    }
  };

  const handleReprovarRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/actions/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: requisicao.id, 
          versao: requisicao.versao, 
          motivo: motivo || 'Reprovado pelo usuário' 
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao reprovar requisição');
      }

      toast.success('Requisição reprovada');
    } catch (error) {
      toast.error('Erro ao reprovar requisição');
      console.error(error);
    }
  };

  const handleCancelarRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/actions/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: requisicao.id, 
          versao: requisicao.versao, 
          motivo: motivo || 'Cancelado pelo usuário' 
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao cancelar requisição');
      }

      toast.success('Requisição cancelada');
    } catch (error) {
      toast.error('Erro ao cancelar requisição');
      console.error(error);
    }
  };

  const handleExcluirRequisicao = async (requisicao: RequisitionDTO) => {
    try {
      const response = await fetch(`/api/requisicoesCompra/${requisicao.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versao: requisicao.versao, 
          motivo: motivo || 'Excluído pelo usuário' 
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir requisição');
      }

      toast.success('Requisição excluída');
    } catch (error) {
      toast.error('Erro ao excluir requisição');
      console.error(error);
    }
  };

  // Renderizar dialogo de confirmação
  const renderConfirmDialog = () => {
    if (!confirmAction) return null;

    const { type, data } = confirmAction;
    
    const typeConfig = {
      reprovar: {
        title: 'Reprovar Requisição',
        description: `Deseja reprovar a requisição ${data.requisicao}?`,
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        color: 'red',
        requiresReason: true,
      },
      cancelar: {
        title: 'Cancelar Requisição',
        description: `Deseja cancelar a requisição ${data.requisicao}?`,
        icon: <XCircle className="h-5 w-5 text-yellow-500" />,
        color: 'yellow',
        requiresReason: true,
      },
      excluir: {
        title: 'Excluir Requisição',
        description: `Deseja excluir permanentemente a requisição ${data.requisicao}?`,
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        color: 'red',
        requiresReason: false,
      },
    };

    const config = typeConfig[type as keyof typeof typeConfig];
    if (!config) return null;

    return (
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {config.icon}
              {config.title}
            </DialogTitle>
            <DialogDescription>
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Esta ação não poderá ser desfeita. Tem certeza que deseja continuar?
              </AlertDescription>
            </Alert>

            {config.requiresReason && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Motivo (opcional):
                </label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo da ação..."
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={processando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmAction}
              disabled={processando}
            >
              {processando ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Renderizar erro
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar requisições: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`h-full ${className}`}>
      <DataTableRequisicoes
        headers={headers}
        rows={requisitions}
        meta={meta}
        carregando={loading}
        limiteColunas={limiteColunas}
        colunasFiltro={colunasDbRequisicao}
        selectedRows={selectedRows}
        searchInputPlaceholder="Pesquisar por requisição, fornecedor, comprador..."
        onSearch={handleSearchChange}
        onSearchKeyDown={handleSearchKeyDown}
        onSearchBlur={handleSearchBlur}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        onRowSelect={handleRowSelect}
        onSelectAll={handleSelectAll}
        onFiltroChange={handleFiltroChange}
        onColunaSubstituida={handleColunaSubstituida}
        onLimiteColunasChange={handleLimiteColunasChange}
        onActionClick={handleActionClick}
      />

      {renderConfirmDialog()}
    </div>
  );
}
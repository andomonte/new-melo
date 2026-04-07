// Componente para gerenciar ordens de compra
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye,
  RefreshCw,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequisitionDTO, RequisitionStatus } from '@/types/compras';
import api from '@/components/services/api';

interface OrdemCompra {
  orc_id: number;
  req_id: number;
  req_versao: number;
  orc_data: string;
  orc_status: string;
  orc_observacao?: string;
  orc_valor_total?: number;
  req_id_composto?: string;
  req_status?: string;
  fornecedor_nome?: string;
  comprador_nome?: string;
  created_at?: string;
  updated_at?: string;
}

interface OrdemCompraManagerProps {
  requisition?: RequisitionDTO;
  onBack?: () => void;
}

// Utilitários para status
const getOrderStatusColor = (status: string) => {
  switch (status) {
    case 'P':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'A':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'F':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'C':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getOrderStatusLabel = (status: string) => {
  switch (status) {
    case 'P':
      return 'Pendente';
    case 'A':
      return 'Aprovada';
    case 'F':
      return 'Finalizada';
    case 'C':
      return 'Cancelada';
    default:
      return 'Desconhecido';
  }
};

const getOrderStatusIcon = (status: string) => {
  switch (status) {
    case 'P':
      return Clock;
    case 'A':
      return CheckCircle;
    case 'F':
      return Package;
    case 'C':
      return XCircle;
    default:
      return AlertTriangle;
  }
};

export const OrdemCompraManager: React.FC<OrdemCompraManagerProps> = ({
  requisition,
  onBack
}) => {
  const [ordens, setOrdens] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  // Carregar ordens ao montar o componente
  useEffect(() => {
    loadOrdens();
  }, [requisition]);

  const loadOrdens = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (requisition?.id) {
        params.append('req_id', requisition.id.toString());
      }
      
      const response = await api.get(`/api/compras/ordens?${params.toString()}`);
      
      if (response.data?.success) {
        setOrdens(response.data.data || []);
      } else {
        throw new Error(response.data?.message || 'Erro ao carregar ordens');
      }
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
      setError('Erro ao carregar ordens de compra');
    } finally {
      setLoading(false);
    }
  };

  const createOrdemFromRequisition = async () => {
    if (!requisition || !requisition.id || !requisition.versao) {
      alert('Dados da requisição inválidos');
      return;
    }

    if (requisition.statusRequisicao !== RequisitionStatus.APPROVED) {
      alert('Apenas requisições aprovadas podem gerar ordens de compra');
      return;
    }

    try {
      setCreating(true);
      
      const response = await api.post('/api/compras/ordens', {
        req_id: requisition.id,
        req_versao: requisition.versao,
        observacao: 'Ordem gerada a partir da requisição aprovada'
      });
      
      if (response.data?.success) {
        alert('Ordem de compra criada com sucesso!');
        await loadOrdens(); // Recarregar lista
      } else {
        throw new Error(response.data?.message || 'Erro ao criar ordem');
      }
    } catch (error) {
      console.error('Erro ao criar ordem:', error);
      alert('Erro ao criar ordem de compra. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const updateOrderStatus = async (orderIn: number, newStatus: string, observacao?: string) => {
    try {
      setUpdatingStatus(orderIn);
      
      const response = await api.put(`/api/compras/ordens/${orderIn}/status`, {
        status: newStatus,
        observacao,
        userId: 'CURRENT_USER' // TODO: Obter do contexto
      });
      
      if (response.data?.success) {
        alert(response.data.message);
        await loadOrdens(); // Recarregar lista
      } else {
        throw new Error(response.data?.message || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status da ordem. Tente novamente.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const canCreateOrder = requisition && 
    requisition.statusRequisicao === RequisitionStatus.APPROVED &&
    ordens.length === 0;

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-500">Carregando ordens...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Ordens de Compra
          </h2>
          {requisition && (
            <p className="text-sm text-gray-500 mt-1">
              Requisição: {requisition.requisicao || `${requisition.id}/${requisition.versao}`}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={loadOrdens}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {canCreateOrder && (
            <Button
              onClick={createOrdemFromRequisition}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Gerar Ordem
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {ordens.length === 0 && !error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nenhuma Ordem de Compra
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {requisition?.statusRequisicao === RequisitionStatus.APPROVED
                  ? 'Esta requisição foi aprovada mas ainda não possui ordem de compra.'
                  : 'Ordens de compra só podem ser geradas a partir de requisições aprovadas.'}
              </p>
              
              {canCreateOrder && (
                <Button
                  onClick={createOrdemFromRequisition}
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Gerar Ordem de Compra
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ordens.map((ordem) => {
            const StatusIcon = getOrderStatusIcon(ordem.orc_status);
            
            return (
              <Card key={ordem.orc_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon className="h-6 w-6 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">
                          Ordem #{ordem.orc_id}
                        </CardTitle>
                        <CardDescription>
                          Criada em {formatDate(ordem.orc_data)}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getOrderStatusColor(ordem.orc_status)}>
                        {getOrderStatusLabel(ordem.orc_status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Requisição:</span>
                      <p className="font-medium">
                        {ordem.req_id_composto || `${ordem.req_id}/${ordem.req_versao}`}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Fornecedor:</span>
                      <p className="font-medium">{ordem.fornecedor_nome || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Comprador:</span>
                      <p className="font-medium">{ordem.comprador_nome || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Valor Total:</span>
                      <p className="font-medium text-green-600">
                        {formatCurrency(ordem.orc_valor_total)}
                      </p>
                    </div>
                  </div>
                  
                  {ordem.orc_observacao && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Observação:</span>
                      <p className="text-sm mt-1">{ordem.orc_observacao}</p>
                    </div>
                  )}
                  
                  {/* Ações */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar
                    </Button>
                    
                    {/* Botão cancelar só aparece para ordens Abertas (A) */}
                    {ordem.orc_status === 'A' && (
                      <>
                        <Button
                          onClick={() => updateOrderStatus(ordem.orc_id, 'C', 'Ordem cancelada')}
                          disabled={updatingStatus === ordem.orc_id}
                          variant="destructive"
                          size="sm"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                    
                    {ordem.orc_status === 'A' && (
                      <Button
                        onClick={() => updateOrderStatus(ordem.orc_id, 'F', 'Ordem finalizada')}
                        disabled={updatingStatus === ordem.orc_id}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {updatingStatus === ordem.orc_id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                          <Package className="h-4 w-4 mr-2" />
                        )}
                        Finalizar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdemCompraManager;
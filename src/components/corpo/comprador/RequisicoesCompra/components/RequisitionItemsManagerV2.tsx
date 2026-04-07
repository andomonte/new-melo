// Versão corrigida do RequisitionItemsManager com validação robusta de IDs
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { ArrowLeft, Save, CheckCircle, Send, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductSearchTableImproved } from './ProductSearchTableImproved';
import { ProductSelectionModal } from './ProductSelectionModal';
import { CartItemsList } from './CartItemsList';
import SugestaoAutomatica from './SugestaoAutomatica';
import { RequisitionDTO, RequisitionStatus, CartItem } from '@/types/compras';
import { Produto } from '../types';
import { useRequisicaoStore } from '../stores/useRequisicaoStoreV2';
import { WorkflowUtils } from '@/lib/compras/workflow';
import api from '@/components/services/api';

interface ItemFormData {
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
}

interface RequisitionItemsManagerProps {
  requisitionId: number | string;
  requisitionVersion: number | string;
  requisitionData?: RequisitionDTO;
  onBack: () => void;
  onStatusChange?: (newStatus: RequisitionStatus) => void;
  readOnly?: boolean;
}

// Utilitários de validação
const validateRequisitionIds = (id: any, version: any): { valid: boolean; id?: number; version?: number; error?: string } => {
  // Converter para números
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  const numVersion = typeof version === 'string' ? parseInt(version, 10) : version;
  
  // Validar se são números válidos
  if (!Number.isInteger(numId) || numId <= 0) {
    return {
      valid: false,
      error: `ID da requisição inválido: ${id}. Deve ser um número inteiro positivo.`
    };
  }
  
  if (!Number.isInteger(numVersion) || numVersion <= 0) {
    return {
      valid: false,
      error: `Versão da requisição inválida: ${version}. Deve ser um número inteiro positivo.`
    };
  }
  
  return {
    valid: true,
    id: numId,
    version: numVersion
  };
};

export const RequisitionItemsManager: React.FC<RequisitionItemsManagerProps> = ({
  requisitionId,
  requisitionVersion,
  requisitionData,
  onBack,
  onStatusChange,
  readOnly = false,
}) => {
  const { user } = useContext(AuthContext);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [error, setError] = useState<string | null>(null);
  const [validatedIds, setValidatedIds] = useState<{ id: number; version: number } | null>(null);

  const {
    currentRequisition,
    cartItems,
    totalCarrinho,
    loading,
    setCurrentRequisition,
    addToCart,
    clearCart,
    loadCartFromRequisition,
    setLoading
  } = useRequisicaoStore();

  // Validar IDs na inicialização
  useEffect(() => {
    const validation = validateRequisitionIds(requisitionId, requisitionVersion);
    
    if (!validation.valid) {
      setError(validation.error || 'IDs inválidos');
      console.error('RequisitionItemsManager - Validação de IDs falhou:', validation.error);
      return;
    }
    
    setValidatedIds({ id: validation.id!, version: validation.version! });
    setError(null);
    
    // Se os IDs são válidos, configurar a requisição
    if (requisitionData) {
      setCurrentRequisition(requisitionData);
    } else {
      // Se não temos dados da requisição, buscar
      loadRequisitionData(validation.id!, validation.version!);
    }
    
    // Cleanup ao desmontar
    return () => {
      clearCart();
    };
  }, [requisitionId, requisitionVersion, requisitionData]);

  // Carregar dados da requisição se não foram fornecidos
  const loadRequisitionData = useCallback(async (id: number, version: number) => {
    try {
      setLoading('dados', true);
      
      const response = await api.get(`/api/requisicoesCompra/${id}/${version}`);
      
      if (response.data?.success && response.data.data) {
        setCurrentRequisition(response.data.data);
        await loadExistingItems(id, version);
      } else {
        throw new Error('Requisição não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar requisição:', error);
      setError('Erro ao carregar dados da requisição. Verifique se ela existe.');
    } finally {
      setLoading('dados', false);
    }
  }, [setCurrentRequisition, setLoading]);

  // Carregar itens existentes
  const loadExistingItems = useCallback(async (id: number, version: number) => {
    try {
      setLoading('cart', true);
      
      const response = await api.get(`/api/requisicoesCompra/${id}/${version}/items`);
      
      if (response.data?.success && response.data.data) {
        loadCartFromRequisition(response.data.data);
        
        // Se há itens, mostrar aba do carrinho
        if (response.data.data.length > 0) {
          setActiveTab('cart');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      // Não é um erro crítico, pode não haver itens ainda
    } finally {
      setLoading('cart', false);
    }
  }, [loadCartFromRequisition, setLoading]);

  // Recarregar itens quando IDs válidos mudarem
  useEffect(() => {
    if (validatedIds && !requisitionData) {
      loadExistingItems(validatedIds.id, validatedIds.version);
    }
  }, [validatedIds, loadExistingItems, requisitionData]);

  const handleProductSelect = (produto: Produto) => {
    if (readOnly) return;
    
    setSelectedProduct(produto);
    setShowProductModal(true);
  };

  const handleProductConfirm = async (formData: ItemFormData) => {
    if (!selectedProduct || !validatedIds) {
      console.error('Produto ou IDs não disponíveis');
      return;
    }

    try {
      setLoading('cart', true);
      
      // Garantir que o produto tem os campos obrigatórios
      if (!selectedProduct.descr) {
        console.error('Produto sem descrição');
        return;
      }
      
      // Adicionar ao carrinho local primeiro
      addToCart(selectedProduct as any, formData.quantidade, formData.preco_unitario);
      
      // Salvar no backend
      const payload = {
        req_id: validatedIds.id,
        req_versao: validatedIds.version,
        codprod: selectedProduct.codprod,
        quantidade: formData.quantidade,
        preco_unitario: formData.preco_unitario,
        observacao: formData.observacao,
        userId: user?.codusr,
        userName: user?.usuario,
      };
      
      const response = await api.post(`/api/requisicoesCompra/${validatedIds.id}/${validatedIds.version}/items`, payload);
      
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Erro ao salvar item');
      }
      
      // Recarregar itens para sincronizar com backend
      await loadExistingItems(validatedIds.id, validatedIds.version);
      
      setShowProductModal(false);
      setSelectedProduct(null);
      setActiveTab('cart');
      
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      // Remove do carrinho local se falhou no backend
      // TODO: Implementar rollback
      alert('Erro ao adicionar item. Tente novamente.');
    } finally {
      setLoading('cart', false);
    }
  };

  const handleProductModalClose = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  const handleSubmitRequisition = async () => {
    if (!validatedIds || !currentRequisition) return;
    
    if (cartItems.length === 0) {
      alert('Adicione pelo menos um item antes de submeter a requisição.');
      return;
    }
    
    try {
      setLoading('saving', true);
      
      const response = await api.put('/api/requisicoesCompra/status/update', {
        id: validatedIds.id,
        versao: validatedIds.version,
        status: RequisitionStatus.SUBMITTED,
        observacao: 'Requisição submetida com itens',
        userId: user?.codusr,
        userName: user?.usuario,
      });
      
      if (response.data?.success) {
        if (onStatusChange) {
          onStatusChange(RequisitionStatus.SUBMITTED);
        }
        alert('Requisição submetida com sucesso!');
      } else {
        throw new Error(response.data?.message || 'Erro ao submeter requisição');
      }
    } catch (error) {
      console.error('Erro ao submeter requisição:', error);
      alert('Erro ao submeter requisição. Tente novamente.');
    } finally {
      setLoading('saving', false);
    }
  };

  // Renderizar erro se IDs inválidos
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-6 w-6" />
              <div>
                <h3 className="text-lg font-medium">Erro de Validação</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar loading enquanto valida
  if (!validatedIds) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Validando requisição...</p>
        </div>
      </div>
    );
  }

  const canEdit = currentRequisition ? 
    [RequisitionStatus.DRAFT, RequisitionStatus.REJECTED].includes(currentRequisition.statusRequisicao as RequisitionStatus)
    : true;

  const currentStatus = currentRequisition?.statusRequisicao as RequisitionStatus || RequisitionStatus.DRAFT;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Gerenciar Itens - Requisição {validatedIds.id}/{validatedIds.version}
                  </h1>
                </div>
                
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>Status:</span>
                  <Badge className={WorkflowUtils.getStatusColor(currentStatus)}>
                    {WorkflowUtils.getStatusLabel(currentStatus)}
                  </Badge>
                  
                  {currentRequisition?.fornecedorNome && (
                    <span>Fornecedor: {currentRequisition.fornecedorNome}</span>
                  )}
                  
                  {currentRequisition?.compradorNome && (
                    <span>Comprador: {currentRequisition.compradorNome}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Ações */}
            <div className="flex items-center gap-2">
              {canEdit && cartItems.length > 0 && (
                <Button
                  onClick={handleSubmitRequisition}
                  disabled={loading.saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading.saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submeter Requisição
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total de Itens:</span>
              <span className="ml-2 font-medium">{cartItems.length}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Valor Total:</span>
              <span className="ml-2 font-medium text-green-600">
                R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Situação:</span>
              <span className="ml-2">
                {readOnly ? 'Somente Leitura' : canEdit ? 'Editável' : 'Bloqueado'}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products" disabled={readOnly}>
                Buscar Produtos
              </TabsTrigger>
              <TabsTrigger value="sugestao" disabled={readOnly}>
                Sugestão Automática
              </TabsTrigger>
              <TabsTrigger value="cart">
                Carrinho ({cartItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="p-6">
              {readOnly ? (
                <div className="text-center py-8 text-gray-500">
                  Modo somente leitura - não é possível adicionar produtos
                </div>
              ) : (
                <ProductSearchTableImproved
                  onSelectProduct={handleProductSelect}
                  isLoading={loading.produtos}
                />
              )}
            </TabsContent>

            <TabsContent value="sugestao" className="p-6">
              {readOnly ? (
                <div className="text-center py-8 text-gray-500">
                  Modo somente leitura - não é possível adicionar produtos
                </div>
              ) : (
                <SugestaoAutomatica
                  reqId={validatedIds.id}
                  reqVersao={validatedIds.version}
                  onItensImportados={(qtd) => {
                    // Recarregar lista de itens após importação
                    loadExistingItems(validatedIds.id, validatedIds.version);
                    // Alternar para tab do carrinho
                    setActiveTab('cart');
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="cart" className="p-6">
              <CartItemsList
                isReadOnly={readOnly || !canEdit}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && selectedProduct && (
        <ProductSelectionModal
          isOpen={showProductModal}
          produto={selectedProduct}
          onConfirm={handleProductConfirm}
          onClose={handleProductModalClose}
          isLoading={loading.cart}
        />
      )}
    </div>
  );
};

export default RequisitionItemsManager;
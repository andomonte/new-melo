import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, CheckCircle, Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductSearchTableImproved } from './ProductSearchTableImproved';
import { ProductSelectionModal } from './ProductSelectionModal';
import { CartItemsList } from './CartItemsList';
import SugestaoAutomatica from './SugestaoAutomatica';
import type { Produto, ItemFormData, CartItem } from '../types';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';
import { createRequisitionItem, getRequisitionItems } from '../services/itemService';
// import { useRequisitionDetails } from '../hooks/useRequisitionDetails';

interface RequisitionItemsManagerProps {
  requisitionId: number;
  requisitionVersion: number;
  requisitionData?: {
    req_id_composto: string;
    req_status: string;
    fornecedor_nome?: string;
    comprador_nome?: string;
  };
  onBack: () => void;
  onStatusChange?: (newStatus: string) => void;
  readOnly?: boolean;
}

export const RequisitionItemsManager: React.FC<RequisitionItemsManagerProps> = ({
  requisitionId,
  requisitionVersion,
  requisitionData,
  onBack,
  onStatusChange,
  readOnly = false,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Produto | null>(null);

  // Use provided data or default
  const currentRequisitionData = requisitionData || {
    req_id_composto: `REQ-${requisitionId}`,
    req_status: 'P',
    fornecedor_nome: '',
    comprador_nome: '',
  };

  const {
    cartItems,
    totalCarrinho,
    setRequisitionData,
    addToCart,
    loadCartItems,
    clearCart,
    setProdutoSelecionado,
  } = useRequisicaoStore();

  // Initialize requisition data in store
  useEffect(() => {
    if (!requisitionId || !requisitionVersion || isNaN(requisitionId) || isNaN(requisitionVersion)) {
      console.error('RequisitionItemsManager: Missing or invalid requisitionId or requisitionVersion', { requisitionId, requisitionVersion });
      return;
    }
    
    setRequisitionData(requisitionId, requisitionVersion);
    loadExistingItems();

    return () => {
      // Cleanup on unmount
      clearCart();
    };
  }, [requisitionId, requisitionVersion]);

  const loadExistingItems = async () => {
    setLoading(true);
    try {
      const response = await getRequisitionItems(requisitionId, requisitionVersion);
      loadCartItems(response.data);
      
      // If there are items, switch to cart tab
      if (response.data.length > 0) {
        setActiveTab('cart');
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (produto: Produto) => {
    setSelectedProduct(produto);
    setProdutoSelecionado(produto);
    setShowProductModal(true);
  };

  const handleProductConfirm = async (formData: ItemFormData) => {
    if (!selectedProduct) return;

    setSaving(true);
    try {
      // Calculate next sequence
      const nextSeq = Math.max(0, ...cartItems.map(item => item.item_seq)) + 1;

      // Add to local store first
      addToCart(selectedProduct, formData.quantidade, formData.preco_unitario);

      // Save to database
      await createRequisitionItem(
        requisitionId,
        requisitionVersion,
        nextSeq,
        formData
      );

      setShowProductModal(false);
      setSelectedProduct(null);
      setActiveTab('cart'); // Switch to cart tab after adding
      
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleProductModalClose = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
    setProdutoSelecionado(null);
  };

  const handleItemEdit = (item: CartItem) => {
    // Converter CartItem para Produto para usar no modal existente
    const produto: Produto = {
      codprod: item.codprod,
      descricao: item.produto?.descricao || item.produto?.descr || item.observacao || '',
      prcompra: item.preco_unitario,
      multiplo: item.produto?.multiplo || 1,
      multiploCompra: item.produto?.multiploCompra || item.produto?.multiplo || 1,
      marca: item.produto?.marca || '',
      aplicacao: item.produto?.aplicacao || '',
      qtddisponivel: item.produto?.qtddisponivel || item.produto?.estoque || 0,
      unimed: item.produto?.unimed || 'UN',
      // Usar dados atuais do item como valores iniciais
      quantidade_inicial: item.quantidade,
      preco_inicial: item.preco_unitario,
      observacao_inicial: item.observacao || '',
      // Passar quantidade sugerida para rastreio
      quantidade_sugerida: item.quantidade_sugerida,
      base_indicacao: item.base_indicacao,
    } as Produto & { quantidade_sugerida?: number; base_indicacao?: string };

    setEditProduct(produto);
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleEditConfirm = async (formData: ItemFormData) => {
    if (!editingItem) return;
    
    setSaving(true);
    try {
      // Atualizar o item no carrinho
      const { updateCartItem } = useRequisicaoStore.getState();
      updateCartItem(editingItem.item_seq, {
        quantidade: formData.quantidade,
        preco_unitario: formData.preco_unitario,
        observacao: formData.observacao,
      });
      
      setShowEditModal(false);
      setEditingItem(null);
      setEditProduct(null);
    } catch (error) {
      console.error('Erro ao editar item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingItem(null);
    setEditProduct(null);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'rascunho':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'approved':
      case 'aprovada':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'rejected':
      case 'reprovada':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'submitted':
      case 'submetida':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const canEditItems = !readOnly && ['pending', 'rascunho', 'p', 'r', 'draft', ''].includes(currentRequisitionData?.req_status?.toLowerCase() || '');

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Itens da Requisição
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentRequisitionData?.req_id_composto}
                </span>
                {currentRequisitionData?.req_status && (
                  <Badge className={getStatusColor(currentRequisitionData.req_status)}>
                    {currentRequisitionData.req_status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!readOnly && (
            <div className="flex gap-2">
              {cartItems.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (onStatusChange) onStatusChange('submitted');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Submeter
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (onStatusChange) onStatusChange('approved');
                    }}
                    className="flex items-center gap-2 text-green-600 hover:text-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Requisition Info */}
        {(currentRequisitionData?.fornecedor_nome || currentRequisitionData?.comprador_nome) && (
          <div className="mt-4 flex gap-6 text-sm text-gray-600 dark:text-gray-400">
            {currentRequisitionData.fornecedor_nome && (
              <span><strong>Fornecedor:</strong> {currentRequisitionData.fornecedor_nome}</span>
            )}
            {currentRequisitionData.comprador_nome && (
              <span><strong>Comprador:</strong> {currentRequisitionData.comprador_nome}</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="p-6 pb-0">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Buscar Produtos
                {!canEditItems && <span className="text-xs">(Somente Leitura)</span>}
              </TabsTrigger>
              <TabsTrigger value="sugestao" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Sugestão Automática
                {!canEditItems && <span className="text-xs">(Somente Leitura)</span>}
              </TabsTrigger>
              <TabsTrigger value="cart" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Itens Selecionados
                {cartItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {cartItems.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Product Search Tab */}
          <TabsContent value="products" className="flex-1 overflow-hidden relative">
            <ProductSearchTableImproved
              onSelectProduct={handleProductSelect}
              isLoading={loading}
            />
            {!canEditItems && (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-gray-100/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Busca de produtos não disponível</p>
                  <p className="text-sm mt-1">Esta requisição não pode ser editada</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Sugestão Automática Tab */}
          <TabsContent value="sugestao" className="flex-1 overflow-hidden relative px-6">
            {canEditItems ? (
              <SugestaoAutomatica
                reqId={requisitionId}
                reqVersao={requisitionVersion}
                onItensImportados={(qtd) => {
                  // Recarregar lista de itens após importação
                  loadExistingItems();
                  // Alternar para tab do carrinho
                  setActiveTab('cart');
                }}
              />
            ) : (
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-gray-100/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Sugestão automática não disponível</p>
                  <p className="text-sm mt-1">Esta requisição não pode ser editada</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Cart Tab */}
          <TabsContent value="cart" className="flex-1 overflow-hidden px-6">
            <CartItemsList
              showActions={canEditItems}
              isReadOnly={readOnly}
              onItemEdit={canEditItems ? handleItemEdit : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Selection Modal */}
      <ProductSelectionModal
        isOpen={showProductModal}
        onClose={handleProductModalClose}
        produto={selectedProduct}
        onConfirm={handleProductConfirm}
        isLoading={saving}
      />

      {/* Product Edit Modal */}
      <ProductSelectionModal
        isOpen={showEditModal}
        onClose={handleEditModalClose}
        produto={editProduct}
        onConfirm={handleEditConfirm}
        isLoading={saving}
        isEditing={true}
      />

      {/* Footer Summary */}
      {cartItems.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-600 p-4 bg-white dark:bg-gray-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'} na requisição
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              Total: R$ {(totalCarrinho || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { Edit2, Trash2, Package, DollarSign, Hash, Save, X, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { CartItem } from '../types';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';

interface CartItemsListProps {
  onItemEdit?: (item: CartItem) => void;
  onItemRemove?: (itemSeq: number) => void;
  showActions?: boolean;
  isReadOnly?: boolean;
}

export const CartItemsList: React.FC<CartItemsListProps> = ({
  onItemEdit,
  onItemRemove,
  showActions = true,
  isReadOnly = false,
}) => {
  const { cartItems, totalCarrinho, updateCartItem, removeFromCart } = useRequisicaoStore();
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    quantidade: number;
    preco_unitario: number;
    observacao: string;
  }>({ quantidade: 0, preco_unitario: 0, observacao: '' });

  const handleEditStart = (item: CartItem) => {
    // Se onItemEdit estiver definido, usa o modal externo (como nas promoções)
    if (onItemEdit) {
      onItemEdit(item);
      return;
    }
    
    // Caso contrário, usa edição inline
    setEditingItem(item.item_seq);
    setEditData({
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      observacao: item.observacao || '',
    });
  };

  const handleEditSave = () => {
    if (editingItem !== null && editData.quantidade > 0 && editData.preco_unitario > 0) {
      updateCartItem(editingItem, editData);
      setEditingItem(null);
      
      // Call external handler if provided
      const item = cartItems.find(i => i.item_seq === editingItem);
      if (item && onItemEdit) {
        onItemEdit({ ...item, ...editData });
      }
    }
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditData({ quantidade: 0, preco_unitario: 0, observacao: '' });
  };

  const handleRemove = (itemSeq: number) => {
    if (window.confirm('Tem certeza que deseja remover este item?')) {
      removeFromCart(itemSeq);
      
      // Call external handler if provided
      if (onItemRemove) {
        onItemRemove(itemSeq);
      }
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center py-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Nenhum item adicionado à requisição</p>
          <p className="text-sm mt-1">Use a busca acima para adicionar produtos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden py-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Itens da Requisição ({cartItems.length})
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Geral</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            R$ {(Number(totalCarrinho) || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {cartItems.map((item) => {
          const isEditing = editingItem === item.item_seq;
          const temQuantidadeSugerida = item.quantidade_sugerida !== undefined && item.quantidade_sugerida !== null;
          const quantidadeAlterada = temQuantidadeSugerida && item.quantidade !== item.quantidade_sugerida;

          return (
            <div
              key={item.item_seq}
              className={`border rounded-lg p-4 bg-white dark:bg-slate-800 ${
                quantidadeAlterada
                  ? 'border-amber-300 dark:border-amber-700'
                  : temQuantidadeSugerida
                    ? 'border-purple-200 dark:border-purple-800'
                    : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Product Info Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {item.produto.descr}
                    </h4>
                    {temQuantidadeSugerida && (
                      quantidadeAlterada ? (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Qtd Alterada ({item.quantidade_sugerida} &rarr; {item.quantidade})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-600">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Sugestão
                        </Badge>
                      )
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1 flex-wrap">
                    <span>Código: {item.produto.codprod}</span>
                    <span>Marca: {item.produto.marca_nome || item.produto.marca || item.produto.codmarca || 'N/A'}</span>
                    {item.produto.ref && <span>Ref: {item.produto.ref}</span>}
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3 text-blue-500" />
                      <span className="font-medium text-blue-700 dark:text-blue-400">
                        Múltiplo: {item.produto.multiploCompra || item.produto.multiplo || 1}
                      </span>
                    </span>
                  </div>
                </div>
                
                {showActions && !isReadOnly && (
                  <div className="flex gap-1">
                    {!isEditing && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditStart(item)}
                          className="h-8 w-8 p-0"
                          title="Editar item"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemove(item.item_seq)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {isEditing && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEditSave}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          title="Salvar alterações"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEditCancel}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Cancelar edição"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Item Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quantity */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Quantidade
                  </label>
                  {isEditing ? (
                    <Input
                      type="number"
                      min="1"
                      value={editData.quantidade}
                      onChange={(e) => setEditData(prev => ({ 
                        ...prev, 
                        quantidade: parseInt(e.target.value) || 0 
                      }))}
                      className="h-8"
                    />
                  ) : (
                    <div className="text-sm font-medium">
                      {item.quantidade} {item.produto.unimed && `${item.produto.unimed}`}
                    </div>
                  )}
                </div>

                {/* Unit Price */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Preço Unitário
                  </label>
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editData.preco_unitario}
                      onChange={(e) => setEditData(prev => ({ 
                        ...prev, 
                        preco_unitario: parseFloat(e.target.value) || 0 
                      }))}
                      className="h-8"
                    />
                  ) : (
                    <div className="text-sm font-medium">
                      R$ {(Number(item.preco_unitario) || 0).toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Total Price */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Total
                  </label>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    R$ {isEditing 
                      ? (Number(editData.quantidade) * Number(editData.preco_unitario) || 0).toFixed(2)
                      : (Number(item.preco_total) || 0).toFixed(2)
                    }
                  </div>
                </div>
              </div>

              {/* Observation */}
              {(item.observacao || isEditing) && (
                <div className="mt-4 space-y-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Observação
                  </label>
                  {isEditing ? (
                    <Textarea
                      value={editData.observacao}
                      onChange={(e) => setEditData(prev => ({ 
                        ...prev, 
                        observacao: e.target.value 
                      }))}
                      placeholder="Observações sobre este item"
                      rows={2}
                      className="text-sm"
                    />
                  ) : (
                    item.observacao && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                        {item.observacao}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Stock Info */}
              {item.produto.estoque !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Estoque disponível:</span>
                  <Badge 
                    variant={item.produto.estoque >= item.quantidade ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {item.produto.estoque}
                  </Badge>
                  {item.produto.estoque < item.quantidade && (
                    <span className="text-xs text-red-500">
                      ⚠️ Quantidade solicitada maior que estoque
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center text-lg font-bold">
          <span className="text-gray-900 dark:text-gray-100">
            Total da Requisição:
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            R$ {(Number(totalCarrinho) || 0).toFixed(2)}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'} •
          Quantidade total: {cartItems.reduce((sum, item) => sum + item.quantidade, 0)}
        </div>
      </div>
    </div>
  );
};
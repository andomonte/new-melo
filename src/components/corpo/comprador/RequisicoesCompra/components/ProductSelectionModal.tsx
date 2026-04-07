import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Hash, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Produto, ItemFormData } from '../types';

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
  onConfirm: (data: ItemFormData) => void;
  isLoading?: boolean;
  isEditing?: boolean;
}

export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  isOpen,
  onClose,
  produto,
  onConfirm,
  isLoading = false,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<ItemFormData>({
    codprod: '',
    quantidade: 1,
    preco_unitario: 0,
    observacao: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when produto changes
  useEffect(() => {
    if (produto) {
      const newFormData = {
        codprod: produto.codprod,
        // Use valores iniciais se estiver editando, senão usa os padrões (prioriza multiploCompra)
        quantidade: produto.quantidade_inicial || produto.multiploCompra || produto.multiplo || 1,
        preco_unitario: produto.preco_inicial || produto.prcompra || 0,
        observacao: produto.observacao_inicial || '',
      };
      
      setFormData(newFormData);
      setErrors({});
    }
  }, [produto]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.quantidade || formData.quantidade <= 0) {
      newErrors.quantidade = 'Quantidade deve ser maior que zero';
    }

    if (!formData.preco_unitario || formData.preco_unitario <= 0) {
      newErrors.preco_unitario = 'Preço deve ser maior que zero';
    }

    if (!formData.codprod || formData.codprod.length !== 6) {
      newErrors.codprod = 'Código do produto deve ter exatamente 6 caracteres';
    }

    // Check if quantity is multiple of produto.multiploCompra (ou multiplo se não houver)
    const multiploParaValidar = produto?.multiploCompra || produto?.multiplo;
    if (multiploParaValidar && multiploParaValidar > 1) {
      if (formData.quantidade % multiploParaValidar !== 0) {
        newErrors.quantidade = `Quantidade deve ser múltiplo de ${multiploParaValidar}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onConfirm(formData);
  };

  const handleInputChange = (field: keyof ItemFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const calculateTotal = () => {
    return formData.quantidade * formData.preco_unitario;
  };

  // Verificar se a quantidade atual difere da quantidade sugerida (apenas em modo edição)
  const temQuantidadeSugerida = isEditing && produto?.quantidade_sugerida !== undefined && produto.quantidade_sugerida !== null;
  const quantidadeAlterada = temQuantidadeSugerida && formData.quantidade !== produto.quantidade_sugerida;
  const diferencaQuantidade = temQuantidadeSugerida ? formData.quantidade - (produto.quantidade_sugerida || 0) : 0;

  if (!isOpen || !produto) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Editar Produto da Requisição' : 'Adicionar Produto à Requisição'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Product Info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {produto.descricao || produto.descr || 'Produto'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Código: {produto.codprod} | Marca: {produto.marca_nome || produto.marca || produto.codmarca || 'N/A'}
                </p>
                {produto.ref && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ref: {produto.ref}
                  </p>
                )}
              </div>
            </div>

            {/* Product stats */}
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Estoque:</span>
                <Badge variant={(produto.qtddisponivel || produto.estoque || 0) > 0 ? 'default' : 'destructive'} className="text-xs">
                  {produto.qtddisponivel || produto.estoque || 0}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4 text-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">Múltiplo Compra:</span>
                <Badge variant="outline" className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  {produto.multiploCompra || produto.multiplo || 1}
                </Badge>
              </div>
            </div>

            {produto.aplicacao && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Aplicação:</strong> {produto.aplicacao}
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Alerta de quantidade sugerida (se item veio de sugestão automática) */}
          {temQuantidadeSugerida && (
            <div className={`p-3 rounded-md border ${
              quantidadeAlterada
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                : 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
            }`}>
              <div className="flex items-start gap-2">
                {quantidadeAlterada ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    quantidadeAlterada
                      ? 'text-amber-800 dark:text-amber-200'
                      : 'text-purple-800 dark:text-purple-200'
                  }`}>
                    {quantidadeAlterada
                      ? 'Quantidade alterada da sugestão original'
                      : 'Item da Sugestão Automática'
                    }
                  </p>
                  <p className={`text-xs mt-1 ${
                    quantidadeAlterada
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-purple-700 dark:text-purple-300'
                  }`}>
                    Quantidade sugerida: <strong>{produto.quantidade_sugerida}</strong>
                    {quantidadeAlterada && (
                      <span className="ml-2">
                        ({diferencaQuantidade > 0 ? '+' : ''}{diferencaQuantidade} unidades)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantidade" className="flex items-center gap-2">
              Quantidade *
              {((produto.multiploCompra && produto.multiploCompra > 1) || (produto.multiplo && produto.multiplo > 1)) && (
                <span className="text-xs text-gray-500">
                  (múltiplo de {produto.multiploCompra || produto.multiplo})
                </span>
              )}
              {quantidadeAlterada && (
                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600">
                  Alterado
                </Badge>
              )}
            </Label>
            <Input
              id="quantidade"
              type="number"
              min="1"
              step={produto.multiploCompra || produto.multiplo || 1}
              value={formData.quantidade}
              onChange={(e) => handleInputChange('quantidade', parseInt(e.target.value) || 0)}
              className={`${errors.quantidade ? 'border-red-500' : ''} ${
                quantidadeAlterada ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10' : ''
              }`}
              placeholder="Digite a quantidade"
            />
            {errors.quantidade && (
              <p className="text-sm text-red-500">{errors.quantidade}</p>
            )}
            {temQuantidadeSugerida && !quantidadeAlterada && (
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Quantidade igual à sugestão automática
              </p>
            )}
          </div>

          {/* Unit Price */}
          <div className="space-y-2">
            <Label htmlFor="preco_unitario">Preço Unitário * (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="preco_unitario"
                type="number"
                min="0"
                step="0.01"
                value={formData.preco_unitario}
                onChange={(e) => handleInputChange('preco_unitario', parseFloat(e.target.value) || 0)}
                className={`pl-10 ${errors.preco_unitario ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.preco_unitario && (
              <p className="text-sm text-red-500">{errors.preco_unitario}</p>
            )}
            
            {/* Price reference */}
            <div className="space-y-1 text-xs">
              {Number(produto.prcompra) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Preço Compra:</span>
                  <span className="font-semibold text-green-700 dark:text-green-400">R$ {Number(produto.prcompra).toFixed(2)}</span>
                </div>
              )}
              {Number(produto.prvenda) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Preço Venda:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">R$ {Number(produto.prvenda).toFixed(2)}</span>
                </div>
              )}
              {Number(produto.prmedio) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Preço Médio:</span>
                  <span className="font-semibold text-purple-700 dark:text-purple-400">R$ {Number(produto.prmedio).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Total Price Display */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Total do Item:
              </span>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                R$ {(Number(calculateTotal()) || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) => handleInputChange('observacao', e.target.value)}
              placeholder="Observações sobre este item (opcional)"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Adicionando...' : 'Adicionar Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
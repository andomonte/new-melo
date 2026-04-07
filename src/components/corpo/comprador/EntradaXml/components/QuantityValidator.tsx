import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface QuantityValidatorProps {
  quantidadeNFe: number;
  quantidadeAssociada: number;
  itemDescricao: string;
  className?: string;
}

interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'warning';
  canProceed: boolean;
}

export const QuantityValidator: React.FC<QuantityValidatorProps> = ({
  quantidadeNFe,
  quantidadeAssociada,
  itemDescricao,
  className = ''
}) => {
  const validate = (): ValidationResult => {
    if (quantidadeAssociada === 0) {
      return {
        isValid: false,
        message: 'Item deve ser associado a pelo menos um pedido de compra',
        type: 'error',
        canProceed: false
      };
    }

    if (quantidadeAssociada < quantidadeNFe) {
      const sobrando = quantidadeNFe - quantidadeAssociada;
      return {
        isValid: false,
        message: `HÁ QUANTIDADE SOBRANDO DESTE ITEM (${sobrando}). VOCÊ DEVE ASSOCIÁ-LA INTEGRALMENTE A PEDIDOS DE COMPRA.`,
        type: 'error',
        canProceed: false
      };
    }

    if (quantidadeAssociada > quantidadeNFe) {
      const excesso = quantidadeAssociada - quantidadeNFe;
      return {
        isValid: false,
        message: `Quantidade associada (${quantidadeAssociada}) excede a quantidade da NFe (${quantidadeNFe}) em ${excesso} unidade(s)`,
        type: 'error',
        canProceed: false
      };
    }

    // quantidadeAssociada === quantidadeNFe
    return {
      isValid: true,
      message: `Quantidade associada corretamente: ${quantidadeAssociada} unidade(s)`,
      type: 'success',
      canProceed: true
    };
  };

  const result = validate();

  const getIcon = () => {
    switch (result.type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (result.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = () => {
    switch (result.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${getBgColor()} ${className}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-700">
              {itemDescricao}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
            <div>
              <span className="font-medium">NFe:</span> {quantidadeNFe}
            </div>
            <div>
              <span className="font-medium">Associada:</span> {quantidadeAssociada}
            </div>
            <div>
              <span className="font-medium">Diferença:</span> {quantidadeNFe - quantidadeAssociada}
            </div>
          </div>

          <p className={`text-sm font-medium ${getTextColor()}`}>
            {result.message}
          </p>

          {/* Barra de progresso visual */}
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  result.type === 'success' 
                    ? 'bg-green-500' 
                    : result.type === 'error' 
                      ? 'bg-red-500' 
                      : 'bg-yellow-500'
                }`}
                style={{ 
                  width: `${Math.min((quantidadeAssociada / quantidadeNFe) * 100, 100)}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>{quantidadeNFe}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook para validar múltiplos itens
export const useQuantityValidation = (items: Array<{
  quantidadeNFe: number;
  quantidadeAssociada: number;
  descricao: string;
}>) => {
  const validateAll = () => {
    const results = items.map((item, index) => ({
      index,
      ...item,
      isValid: item.quantidadeAssociada === item.quantidadeNFe,
      canProceed: item.quantidadeAssociada === item.quantidadeNFe
    }));

    const allValid = results.every(r => r.isValid);
    const invalidItems = results.filter(r => !r.isValid);
    const totalItems = results.length;
    const validItems = results.filter(r => r.isValid).length;

    return {
      allValid,
      canProceed: allValid,
      invalidItems,
      totalItems,
      validItems,
      progressPercent: totalItems > 0 ? (validItems / totalItems) * 100 : 0,
      summary: {
        total: totalItems,
        valid: validItems,
        invalid: invalidItems.length,
        message: allValid 
          ? 'Todos os itens foram associados corretamente'
          : `${invalidItems.length} item(s) precisam ser corrigidos`
      }
    };
  };

  return { validateAll };
};
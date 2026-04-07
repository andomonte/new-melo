import React from 'react';
import { CreditCard, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequisitionDTO } from '@/types/compras/requisition';

interface AssociacoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisicao: RequisitionDTO;
  tipo: 'CONTA_PAGAR' | 'ESTOQUE';
  onSuccess?: () => void;
}

export const AssociacoesModal: React.FC<AssociacoesModalProps> = ({
  isOpen,
  onClose,
  requisicao,
  tipo,
  onSuccess
}) => {
  const getTitulo = () => {
    return tipo === 'CONTA_PAGAR' ? 'Contas a Pagar' : 'Associação com Estoque';
  };

  const getIcone = () => {
    return tipo === 'CONTA_PAGAR' ? CreditCard : Package;
  };

  if (!isOpen) return null;

  const Icon = getIcone();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Icon className="text-blue-500" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {getTitulo()}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Requisição #{requisicao.requisicao || requisicao.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="text-center py-8">
          <Icon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            {getTitulo()}
          </h4>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Esta funcionalidade será implementada em breve.
          </p>
          <p className="text-sm text-gray-400">
            Permitirá {tipo === 'CONTA_PAGAR' ? 'associar contas a pagar' : 'definir locais de estoque'} para esta requisição.
          </p>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
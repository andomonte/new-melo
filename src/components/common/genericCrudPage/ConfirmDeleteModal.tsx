// Local sugerido: src/components/common/Modals/ConfirmDeleteModal.tsx

import React, { useState, useEffect } from 'react';
import { DefaultButton } from '@/components/common/Buttons'; // Ajuste o caminho se necessário
import Carregamento from '@/utils/carregamento'; // Ajuste o caminho se necessário

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entityName: string; // ex: "formação de preço", "produto"
  itemName?: string; // ex: "123456", "Produto A"
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entityName,
  itemName,
}) => {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reseta o estado do modal sempre que ele for aberto
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setStatus('loading');
    try {
      await onConfirm();
      setStatus('success');
      setTimeout(() => {
        onClose(); // Fecha o modal automaticamente após o sucesso
      }, 1500);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(
        error.message || `Erro ao deletar o ${entityName}. Tente novamente.`,
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg w-full max-w-md">
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          {status === 'idle' && (
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-gray-100">
                Confirmar Exclusão
              </h3>
              <p className="text-slate-600 dark:text-gray-300 mb-6">
                Tem certeza que deseja excluir o {entityName}
                {itemName && <strong className="ml-1">{itemName}</strong>}?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          )}
          {status === 'loading' && (
            <Carregamento texto={`Excluindo o ${entityName}...`} />
          )}
          {status === 'success' && (
            <div className="text-center text-green-600 dark:text-green-400">
              <div className="text-4xl mb-4">✓</div>
              <p className="text-slate-800 dark:text-gray-100">
                {entityName} excluído com sucesso!
              </p>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 text-4xl mb-4">
                ✗
              </div>
              <p className="font-semibold text-red-600 dark:text-red-400 mb-2">
                Erro ao Excluir
              </p>
              <p className="text-slate-600 dark:text-gray-300 text-sm">
                {errorMessage}
              </p>
            </div>
          )}
        </div>
        {(status === 'idle' || status === 'error') && (
          <div className="flex justify-end gap-2 pt-4">
            {status === 'idle' && (
              <>
                <DefaultButton
                  onClick={onClose}
                  variant="cancel"
                  text="Cancelar"
                />
                <DefaultButton
                  onClick={handleConfirm}
                  variant="confirm"
                  text="Sim, Excluir"
                />
              </>
            )}
            {status === 'error' && (
              <DefaultButton
                onClick={onClose}
                variant="secondary"
                text="Fechar"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

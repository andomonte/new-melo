import React from 'react';
import { Button } from '@/components/ui/button';
import { CreditoTemporarioContent } from './CreditoTemporarioContent';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientePreselecionado?: { codcli: string; nome: string } | null;
}

export function CreditoTemporarioModal({
  isOpen,
  onClose,
  clientePreselecionado,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[1100px] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <h4 className="text-lg font-bold text-blue-600 dark:text-blue-300">
            Crédito Temporário
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-zinc-900">
          <CreditoTemporarioContent clientePreselecionado={clientePreselecionado} />
        </div>

        {/* Rodapé */}
        <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CreditoTemporarioModal;

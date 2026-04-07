import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const DecisionModal: React.FC<DecisionModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Continuar Agora',
  cancelText = 'Fazer Depois'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl min-w-[500px] max-w-[600px] mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="px-6 py-2"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DecisionModal;

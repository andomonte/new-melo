import React, { useState } from 'react';
import { DefaultButton } from '@/components/common/Buttons';
import { FaPrint } from 'react-icons/fa6';

interface PrintReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (motivo: string) => void;
  loading?: boolean;
  nrVenda: string;
  title?: string;
  description?: string;
  minCharacters?: number;
}

/**
 * Modal compartilhado para captura de motivo de impressão
 * Usado em diferentes módulos (operacional, separação, etc.)
 */
const PrintReasonModal: React.FC<PrintReasonModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  nrVenda,
  title = 'Motivo da Impressão',
  description = 'Por favor, informe o motivo da impressão do pedido.',
  minCharacters = 15,
}) => {
  const [motivo, setMotivo] = useState('');

  const handleSubmit = () => {
    if (motivo.trim().length >= minCharacters) {
      onSubmit(motivo.trim());
      setMotivo('');
    }
  };

  const handleClose = () => {
    setMotivo('');
    onClose();
  };

  const isValid = motivo.trim().length >= minCharacters;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay de fundo para fechar ao clicar fora */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center mb-4">
            <FaPrint className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {loading ? 'Processando Impressão...' : title}
            </h3>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Pedido: <span className="font-medium">{nrVenda}</span>
          </p>

          {!loading ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {description}
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Digite o motivo da impressão..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                  disabled={loading}
                />
                <div className="flex justify-between items-center mt-1">
                  <span
                    className={`text-xs ${
                      motivo.length < minCharacters
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}
                  >
                    {motivo.length}/{minCharacters} caracteres
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <DefaultButton
                  text="Cancelar"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={loading}
                />
                <DefaultButton
                  text="Confirmar"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={loading || !isValid}
                  icon={<FaPrint className="w-4 h-4" />}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Salvando venda na fila de impressão e enviando para
                impressora...
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PrintReasonModal;

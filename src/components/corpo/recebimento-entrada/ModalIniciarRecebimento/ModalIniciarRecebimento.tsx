/**
 * Modal para iniciar novo recebimento por chave da NFe
 */

import React from 'react';
import { Package, Type, Barcode, X } from 'lucide-react';
import {
  Recebedor,
  EntradaParaReceber,
} from '@/data/recebimento-entrada/recebimentoEntradaService';
import { useIniciarRecebimento } from './hooks/useIniciarRecebimento';
import { MODAL_MODES } from './constants';
import TabDigitar from './components/TabDigitar';
import TabEscanear from './components/TabEscanear';

interface ModalIniciarRecebimentoProps {
  isOpen: boolean;
  onClose: () => void;
  recebedor: Recebedor;
  onSuccess: (entrada: EntradaParaReceber) => void;
}

const ModalIniciarRecebimento: React.FC<ModalIniciarRecebimentoProps> = ({
  isOpen,
  onClose,
  recebedor,
  onSuccess,
}) => {
  const {
    chaveNFe,
    isLoading,
    modalMode,
    isScanning,
    isChaveValida,
    inputRef,
    handleClose,
    handleModeChange,
    handleInputChange,
    handleManualSubmit,
    handleBarcodeInput,
    handleKeyDown,
  } = useIniciarRecebimento({
    isOpen,
    recebedor,
    onSuccess,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Iniciar Novo Recebimento
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => handleModeChange(MODAL_MODES.MANUAL)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
              modalMode === MODAL_MODES.MANUAL
                ? 'bg-white dark:bg-zinc-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Type className="w-4 h-4" />
            <span className="font-medium">Digitar Código</span>
          </button>
          <button
            onClick={() => handleModeChange(MODAL_MODES.BARCODE)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
              modalMode === MODAL_MODES.BARCODE
                ? 'bg-white dark:bg-zinc-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span className="font-medium">Escanear Código</span>
          </button>
        </div>

        {/* Conteúdo baseado no modo */}
        <div className="space-y-4">
          {modalMode === MODAL_MODES.MANUAL ? (
            <TabDigitar
              chaveNFe={chaveNFe}
              isLoading={isLoading}
              isChaveValida={isChaveValida}
              recebedor={recebedor}
              inputRef={inputRef}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onSubmit={handleManualSubmit}
              onClose={handleClose}
            />
          ) : (
            <TabEscanear
              chaveNFe={chaveNFe}
              isLoading={isLoading}
              isScanning={isScanning}
              recebedor={recebedor}
              onBarcodeInput={handleBarcodeInput}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalIniciarRecebimento;

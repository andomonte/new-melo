/**
 * Aba de escanear código de barras com câmera
 */

import React from 'react';
import { Barcode } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { Recebedor } from '@/data/recebimento-entrada/recebimentoEntradaService';
import { CHAVE_NFE_LENGTH } from '../constants';
import BarcodeScanner from './BarcodeScanner';

interface TabEscanearProps {
  chaveNFe: string;
  isLoading: boolean;
  isScanning: boolean;
  recebedor: Recebedor;
  onBarcodeInput: (value: string) => void;
  onClose: () => void;
}

const TabEscanear: React.FC<TabEscanearProps> = ({
  chaveNFe,
  isLoading,
  isScanning,
  recebedor,
  onBarcodeInput,
  onClose,
}) => {
  const handleScan = (code: string) => {
    onBarcodeInput(code);
  };

  return (
    <div className="space-y-4">
      {/* Alerta informativo */}
      <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-emerald-800 dark:text-emerald-200">
            <p className="font-medium mb-1">Modo Scanner:</p>
            <p>
              Aponte a câmera para o código de barras da NFe.
              O recebimento será iniciado automaticamente ao ler o código.
            </p>
          </div>
        </div>
      </div>

      {/* Scanner de câmera */}
      <BarcodeScanner
        isActive={isScanning}
        onScan={handleScan}
        onError={(err) => console.error('Erro no scanner:', err)}
      />

      {/* Exibir código lido */}
      {chaveNFe && (
        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Código lido:
          </p>
          <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
            {chaveNFe}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {chaveNFe.length} digitos
            {chaveNFe.length === CHAVE_NFE_LENGTH && (
              <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                ✓ Iniciando recebimento...
              </span>
            )}
          </p>
        </div>
      )}

      {/* Info do recebedor */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Recebedor:</strong> {recebedor.nome}
          </p>
          <p>
            <strong>Matrícula:</strong> {recebedor.matricula}
          </p>
        </div>
      </div>

      {/* Botão cancelar */}
      <div className="flex gap-3 pt-4">
        <DefaultButton
          text="Cancelar"
          variant="secondary"
          onClick={onClose}
          size="sm"
          className="w-full"
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default TabEscanear;

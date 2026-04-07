/**
 * Aba de digitar código manualmente
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { Recebedor } from '@/data/recebimento-entrada/recebimentoEntradaService';
import { CHAVE_NFE_LENGTH, CHAVE_MAX_LENGTH, PLACEHOLDERS } from '../constants';

interface TabDigitarProps {
  chaveNFe: string;
  isLoading: boolean;
  isChaveValida: boolean;
  recebedor: Recebedor;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const TabDigitar: React.FC<TabDigitarProps> = ({
  chaveNFe,
  isLoading,
  isChaveValida,
  recebedor,
  inputRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="space-y-4">
      {/* Alerta informativo */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Atenção:</p>
            <p>
              Digite ou cole a chave de acesso da NFe ({CHAVE_NFE_LENGTH} digitos) ou chave de importacao.
              A chave pode ser encontrada no DANFE ou no XML da nota fiscal.
            </p>
          </div>
        </div>
      </div>

      {/* Input da chave */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Chave da NFe
        </label>
        <input
          ref={inputRef}
          type="text"
          value={chaveNFe}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDERS.INPUT_CHAVE}
          maxLength={CHAVE_MAX_LENGTH}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
          disabled={isLoading}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {chaveNFe.length} digitos
        </p>
      </div>

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

      {/* Botões */}
      <div className="flex gap-3 pt-4">
        <DefaultButton
          text="Cancelar"
          variant="secondary"
          onClick={onClose}
          size="sm"
          className="flex-1"
          disabled={isLoading}
        />
        <DefaultButton
          text={isLoading ? 'Iniciando...' : 'Iniciar Recebimento'}
          variant="primary"
          onClick={onSubmit}
          size="sm"
          className="flex-1"
          disabled={isLoading || !isChaveValida}
        />
      </div>
    </div>
  );
};

export default TabDigitar;

// src/components/common/InscricaoEstadualField.tsx

import React from 'react';
import { InscricaoEstadual } from '@/data/inscricoesEstaduais/inscricoesEstaduais';

interface InscricaoEstadualFieldProps {
  inscricoes: InscricaoEstadual[];
  label?: string;
  onFieldClick: () => void;
  disabled?: boolean;
  error?: string;
}

const InscricaoEstadualField: React.FC<InscricaoEstadualFieldProps> = ({
  inscricoes,
  label = 'Inscrição Estadual',
  onFieldClick,
  disabled = false,
  error,
}) => {
  const getDisplayText = () => {
    if (inscricoes.length === 0) {
      return 'Nenhuma inscrição cadastrada';
    }
    return `${inscricoes.length} insc. estadual${inscricoes.length > 1 ? 'is' : ''}`;
  };

  return (
    <div className="flex flex-col space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div
        onClick={!disabled ? onFieldClick : undefined}
        className={`px-3 py-2 border rounded-md cursor-pointer transition-colors ${
          disabled
            ? 'bg-gray-100 dark:bg-zinc-700 cursor-not-allowed'
            : 'bg-white dark:bg-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-500'
        } ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <div
          className={`text-sm ${
            inscricoes.length === 0
              ? 'text-gray-500 dark:text-gray-400 italic'
              : 'text-gray-800 dark:text-gray-100 font-medium'
          }`}
        >
          {getDisplayText()}
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
        Clique para gerenciar inscrições
      </p>
    </div>
  );
};

export default InscricaoEstadualField;

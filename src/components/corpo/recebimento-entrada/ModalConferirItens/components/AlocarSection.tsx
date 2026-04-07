/**
 * Secao de alocacao/romaneio com selecao de armazem
 * Ao selecionar um armazem, ja aplica automaticamente para todos os itens
 */

import React from 'react';
import { Warehouse, CheckCircle, Info } from 'lucide-react';
import { Armazem } from '../constants';

interface AlocarSectionProps {
  armazens: Armazem[];
  armazemSelecionado: number | null;
  onArmazemChange: (armazemId: number) => void;
  loading?: boolean;
}

const AlocarSection: React.FC<AlocarSectionProps> = ({
  armazens,
  armazemSelecionado,
  onArmazemChange,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
          <span className="text-sm">Carregando armazens...</span>
        </div>
      </div>
    );
  }

  if (armazens.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-zinc-700">
      {/* Info */}
      <div className="flex items-center gap-2 mb-3">
        <Warehouse className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Alocacao de Armazem
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3 h-3" />
          <span>Selecione o armazem de destino para os itens</span>
        </div>
      </div>

      {/* Seletor de armazem - ao clicar ja aplica para todos */}
      <div className="flex flex-wrap gap-2">
        {armazens.map((arm) => (
          <button
            key={arm.arm_id}
            onClick={() => onArmazemChange(arm.arm_id)}
            className={`relative px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
              armazemSelecionado === arm.arm_id
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
            }`}
          >
            {armazemSelecionado === arm.arm_id && (
              <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full text-blue-600" />
            )}
            <div className="flex items-center gap-2">
              <Warehouse className={`w-4 h-4 ${armazemSelecionado === arm.arm_id ? 'text-white' : 'text-blue-500'}`} />
              {arm.arm_descricao}
            </div>
            {arm.arm_municipio && (
              <div className={`text-xs ${armazemSelecionado === arm.arm_id ? 'text-blue-100' : 'text-gray-400'}`}>
                {arm.arm_municipio}/{arm.arm_uf}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AlocarSection;

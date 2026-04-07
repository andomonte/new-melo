/**
 * Cabecalho da tela de Entradas de Mercadorias
 */

import React from 'react';
import { Plus, RefreshCcw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntradasHeaderProps {
  onRefresh: () => void;
  onNovaEntrada: () => void;
  onGerarEntrada: () => void;
  canManageEntradas: boolean;
}

export const EntradasHeader: React.FC<EntradasHeaderProps> = ({
  onRefresh,
  onNovaEntrada,
  onGerarEntrada,
  canManageEntradas,
}) => {
  return (
    <div className="px-6 pt-4 pb-2 flex-shrink-0">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
          Entradas de Mercadorias
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <RefreshCcw size={16} />
          </Button>

          {canManageEntradas && (
            <>
              <Button
                onClick={onGerarEntrada}
                className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
              >
                <Package size={16} />
                Gerar Entrada
              </Button>
              <Button
                onClick={onNovaEntrada}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus size={18} />
                Nova Entrada
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

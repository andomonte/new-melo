/**
 * Modal para dividir um item de fatura em duas partes
 * Permite vincular cada parte a uma OC diferente
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ItemImportacao } from '../types/importacao';

interface DividirItemModalProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (qtdPrimeiro: number) => void;
  item: ItemImportacao | null;
}

export const DividirItemModal: React.FC<DividirItemModalProps> = ({
  aberto,
  onFechar,
  onConfirmar,
  item,
}) => {
  const [qtdPrimeiro, setQtdPrimeiro] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setQtdPrimeiro('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aberto]);

  if (!aberto || !item) return null;

  const qtdTotal = item.qtd;
  const qtdNum = parseInt(qtdPrimeiro) || 0;
  const qtdSegundo = qtdTotal - qtdNum;
  const valido = qtdNum > 0 && qtdNum < qtdTotal && Number.isInteger(qtdNum);

  const handleConfirmar = () => {
    if (valido) onConfirmar(qtdNum);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && valido) handleConfirmar();
    if (e.key === 'Escape') onFechar();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Scissors size={18} className="text-[#347AB6]" />
            <h3 className="text-lg font-bold text-[#347AB6]">Dividir Item</h3>
          </div>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 py-5 space-y-4">
          {/* Info do item */}
          <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-md text-xs space-y-1">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Produto:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {item.codprod || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Descricao:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {item.descricao || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Quantidade atual:</span>{' '}
              <span className="font-bold text-gray-900 dark:text-gray-100">{qtdTotal} un</span>
            </div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantidade da 1a parte
            </label>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={qtdTotal - 1}
              step={1}
              value={qtdPrimeiro}
              onChange={(e) => setQtdPrimeiro(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`1 a ${qtdTotal - 1}`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
            />
          </div>

          {/* Preview da divisão */}
          {qtdNum > 0 && (
            <div className="flex gap-3 text-xs">
              <div className={`flex-1 p-2 rounded-md border ${valido ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                <span className="text-gray-500 dark:text-gray-400">1a parte: </span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{qtdNum} un</span>
                {item.id_orc && (
                  <div className="text-[10px] text-gray-400 mt-0.5">mantem PC: {item.id_orc}</div>
                )}
              </div>
              <div className={`flex-1 p-2 rounded-md border ${valido ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                <span className="text-gray-500 dark:text-gray-400">2a parte: </span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{qtdSegundo} un</span>
                <div className="text-[10px] text-gray-400 mt-0.5">sem vinculo (revincular)</div>
              </div>
            </div>
          )}

          {/* Validação */}
          {qtdPrimeiro && !valido && (
            <p className="text-xs text-red-500">
              {qtdNum <= 0
                ? 'A quantidade deve ser maior que 0'
                : qtdNum >= qtdTotal
                  ? 'A quantidade deve ser menor que o total'
                  : 'A quantidade deve ser um numero inteiro'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-zinc-700">
          <Button variant="outline" size="sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!valido}
            onClick={handleConfirmar}
            className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            Dividir
          </Button>
        </div>
      </div>
    </div>
  );
};

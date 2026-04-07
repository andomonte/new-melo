/**
 * Modal para mover itens entre faturas
 * Permite selecionar itens e escolher fatura destino (existente ou nova)
 */

import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaturaImportacao } from '../types/importacao';

interface MoverItensModalProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (itensIndices: number[], destinoFaturaIdx: number | 'nova') => void;
  faturaOrigem: FaturaImportacao;
  faturaOrigemIdx: number;
  todasFaturas: FaturaImportacao[];
}

export const MoverItensModal: React.FC<MoverItensModalProps> = ({
  aberto,
  onFechar,
  onConfirmar,
  faturaOrigem,
  faturaOrigemIdx,
  todasFaturas,
}) => {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [destino, setDestino] = useState<number | 'nova'>('nova');

  useEffect(() => {
    if (aberto) {
      setSelecionados(new Set());
      setDestino('nova');
    }
  }, [aberto]);

  if (!aberto) return null;

  const itens = faturaOrigem.itens || [];
  const totalItens = itens.length;
  const todosSelecionados = selecionados.size === totalItens;
  const valido = selecionados.size > 0 && !todosSelecionados;

  const toggleItem = (idx: number) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx);
      else novo.add(idx);
      return novo;
    });
  };

  const handleConfirmar = () => {
    if (valido) onConfirmar(Array.from(selecionados), destino);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-[#347AB6]" />
            <h3 className="text-lg font-bold text-[#347AB6]">
              Mover Itens - Fatura {faturaOrigemIdx + 1}
            </h3>
          </div>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-auto">
          {/* Seleção de itens */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecione os itens para mover:
            </label>
            <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              {itens.map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 text-xs border-b border-gray-100 dark:border-zinc-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(idx)}
                    onChange={() => toggleItem(idx)}
                    className="rounded border-gray-300 dark:border-zinc-600 text-[#347AB6] focus:ring-[#347AB6]/40"
                  />
                  <span className="font-mono text-gray-500 dark:text-gray-400 w-20 shrink-0">
                    {item.codprod || '-'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                    {item.descricao || '-'}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium shrink-0">
                    {item.qtd} un
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Validação: todos selecionados */}
          {todosSelecionados && selecionados.size > 0 && (
            <p className="text-xs text-red-500">
              Nao e possivel mover todos os itens. Pelo menos 1 item deve permanecer na fatura de origem.
            </p>
          )}

          {/* Seleção de destino */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mover para:
            </label>
            <div className="space-y-1">
              {todasFaturas.map((f, idx) => {
                if (idx === faturaOrigemIdx) return null;
                return (
                  <label
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2 text-xs rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="destino"
                      checked={destino === idx}
                      onChange={() => setDestino(idx)}
                      className="text-[#347AB6] focus:ring-[#347AB6]/40"
                    />
                    <span className="text-gray-900 dark:text-gray-100">
                      Fatura {idx + 1} - {f.fornecedor_nome || f.cod_credor || 'N/A'}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">
                      ({f.itens?.length || 0} itens)
                    </span>
                  </label>
                );
              })}
              <label className="flex items-center gap-3 px-3 py-2 text-xs rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border border-dashed border-gray-300 dark:border-zinc-600">
                <input
                  type="radio"
                  name="destino"
                  checked={destino === 'nova'}
                  onChange={() => setDestino('nova')}
                  className="text-[#347AB6] focus:ring-[#347AB6]/40"
                />
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  Nova fatura (mesmo fornecedor)
                </span>
              </label>
            </div>
          </div>
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
            Mover {selecionados.size > 0 ? `${selecionados.size} ${selecionados.size === 1 ? 'item' : 'itens'}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal para adicionar contrato de câmbio
 * Padrão visual do sistema (raw tailwind, sem shadcn Dialog)
 */

import React from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ContratoCambio } from '../types/importacao';
import { FormField } from './SectionPanel';

interface ContratoModalProps {
  aberto: boolean;
  form: Partial<ContratoCambio>;
  onFechar: () => void;
  onCampo: (campo: keyof ContratoCambio, valor: string | number) => void;
  onSalvar: () => void;
  podeSalvar: boolean;
}

export const ContratoModal: React.FC<ContratoModalProps> = ({
  aberto,
  form,
  onFechar,
  onCampo,
  onSalvar,
  podeSalvar,
}) => {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg border border-gray-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Adicionar Contrato de Câmbio
          </h3>
          <button onClick={onFechar} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <FormField label="Nº Contrato">
            <Input
              placeholder="000529545244"
              value={form.contrato || ''}
              onChange={(e) => onCampo('contrato', e.target.value)}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Data">
            <Input
              type="date"
              value={form.data || ''}
              onChange={(e) => onCampo('data', e.target.value)}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Moeda">
            <Input
              placeholder="USD"
              value={form.moeda || 'USD'}
              onChange={(e) => onCampo('moeda', e.target.value)}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Valor (Moeda Estrangeira)">
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.vl_merc_dolar || ''}
              onChange={(e) => onCampo('vl_merc_dolar', parseFloat(e.target.value))}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Taxa Câmbio">
            <Input
              type="number"
              step="0.0001"
              placeholder="0.0000"
              value={form.taxa_dolar || ''}
              onChange={(e) => onCampo('taxa_dolar', parseFloat(e.target.value))}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Valor (BRL)">
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.vl_reais || ''}
              onChange={(e) => onCampo('vl_reais', parseFloat(e.target.value))}
              className="h-8 text-sm"
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-zinc-700">
          <Button variant="outline" size="sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!podeSalvar}
            onClick={onSalvar}
            className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
};

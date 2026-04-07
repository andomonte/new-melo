/**
 * Card de item individual para conferencia
 */

import React from 'react';
import { Save, Loader2, Warehouse } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import {
  StatusItem,
  ItemLocal,
  Armazem,
  STATUS_CONFIG,
  STATUS_OPTIONS,
} from '../constants';

interface ItemCardProps {
  item: ItemLocal;
  index: number;
  armazens: Armazem[];
  onQtdChange: (index: number, value: number) => void;
  onStatusChange: (index: number, status: StatusItem) => void;
  onObservacaoChange: (index: number, value: string) => void;
  onArmazemChange: (index: number, armazemId: number) => void;
  onSalvarItem: (index: number) => void;
  getArmazemNome: (armId: number | null) => string;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  index,
  armazens,
  onQtdChange,
  onStatusChange,
  onObservacaoChange,
  onArmazemChange,
  onSalvarItem,
  getArmazemNome,
}) => {
  return (
    <div
      className={`border rounded-lg p-4 ${
        item.modificado
          ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
      }`}
    >
      {/* Header do item */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {item.produto_cod} - {item.produto_nome}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esperado: {item.qtd_esperada} {item.unidade}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <span
            className={`${STATUS_CONFIG[item.statusLocal].color} px-2 py-1 rounded text-xs font-medium flex items-center gap-1`}
          >
            {STATUS_CONFIG[item.statusLocal].icon}
            {STATUS_CONFIG[item.statusLocal].label}
          </span>
          {item.modificado && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              * Modificado
            </span>
          )}
        </div>
      </div>

      {/* Campos de edicao */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Quantidade recebida */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Qtd Recebida
          </label>
          <input
            type="number"
            value={item.qtdRecebidaLocal}
            onChange={(e) => onQtdChange(index, parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:text-white"
            step="0.01"
            min="0"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={item.statusLocal}
            onChange={(e) => onStatusChange(index, e.target.value as StatusItem)}
            className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:text-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Armazem */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Warehouse className="w-3 h-3 inline mr-1" />
            Armazem
          </label>
          <select
            value={item.armazemId || ''}
            onChange={(e) => onArmazemChange(index, parseInt(e.target.value))}
            className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:text-white"
          >
            {armazens.map((arm) => (
              <option key={arm.arm_id} value={arm.arm_id}>
                {arm.arm_descricao}
              </option>
            ))}
          </select>
        </div>

        {/* Observacao */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Observacao
          </label>
          <input
            type="text"
            value={item.observacaoLocal}
            onChange={(e) => onObservacaoChange(index, e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:text-white"
          />
        </div>
      </div>

      {/* Botao salvar individual */}
      {item.modificado && (
        <div className="mt-2 flex justify-end">
          <DefaultButton
            text={item.salvando ? 'Salvando...' : 'Salvar Item'}
            size="sm"
            variant="secondary"
            onClick={() => onSalvarItem(index)}
            icon={
              item.salvando ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )
            }
            disabled={item.salvando}
          />
        </div>
      )}
    </div>
  );
};

export default ItemCard;

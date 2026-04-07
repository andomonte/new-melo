/**
 * Constantes do módulo de Importação
 */

import type { ImportacaoTab, StatusImportacao } from '../types/importacao';

export const TABS: { key: ImportacaoTab; label: string }[] = [
  { key: 'geral', label: 'Dados Gerais' },
  { key: 'contratos', label: 'Contratos de Câmbio' },
  { key: 'faturas', label: 'Faturas / Pedidos' },
  { key: 'custos', label: 'Custos' },
];

export const STATUS_COLORS: Record<StatusImportacao, string> = {
  N: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  E: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  C: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

export const MOEDAS = ['USD', 'EUR', 'CNY', 'JPY'] as const;

/**
 * Helpers para a tela de Entradas de Mercadorias
 */

import { colunasDbEntrada } from '../colunasDbEntrada';

/**
 * Retorna o label de uma coluna pelo campo
 */
export const getHeaderLabel = (campo: string): string => {
  const coluna = colunasDbEntrada.find(col => col.campo === campo);
  return coluna?.label || campo.toUpperCase();
};

/**
 * Formata uma data para o formato brasileiro (dd/mm/yyyy)
 */
export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
};

/**
 * Formata um valor para moeda brasileira (R$)
 */
export const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Verifica se uma coluna e fixa (nao pode ser substituida)
 */
export const isColumnFixed = (header: string): boolean => {
  return header === 'acoes';
};

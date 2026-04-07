/**
 * Formatadores de valores para o módulo de Importação
 */

export const fmtUSD = (valor: number): string =>
  valor.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const fmtBRL = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtTaxa = (valor: number): string =>
  `R$ ${valor.toFixed(4)}`;

export const fmtDate = (data: string): string => {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
};

export const fmtDecimal = (valor: number | undefined, casas = 2): string => {
  if (valor === undefined || valor === null) return '-';
  return valor.toFixed(casas);
};

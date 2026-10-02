/**
 * Formatadores de valores para o módulo de Importação
 *
 * Os valores podem chegar como number (parse do XML) ou como string
 * (numeric do Postgres volta como string após salvar/recarregar a DI),
 * então todos coagem para número antes de formatar.
 */

/** Coage string|number para número finito; null/undefined/NaN → null. */
const toNum = (valor: unknown): number | null => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
};

export const fmtUSD = (valor: number | string | undefined): string => {
  const n = toNum(valor);
  return (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const fmtBRL = (valor: number | string | undefined): string => {
  const n = toNum(valor);
  return (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const fmtTaxa = (valor: number | string | undefined): string =>
  `R$ ${(toNum(valor) ?? 0).toFixed(4)}`;

export const fmtDate = (data: string): string => {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
};

export const fmtDecimal = (valor: number | string | undefined, casas = 2): string => {
  const n = toNum(valor);
  if (n === null) return '-';
  return n.toFixed(casas);
};

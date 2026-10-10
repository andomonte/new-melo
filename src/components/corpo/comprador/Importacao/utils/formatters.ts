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
  // Formata a partir da parte YYYY-MM-DD (ignora hora/UTC) para não deslocar o dia.
  // `new Date('2026-09-08')` é meia-noite UTC → em fuso -3/-4 voltava para 07/09.
  const s = String(data).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(data);
  return isNaN(d.getTime()) ? data : d.toLocaleDateString('pt-BR');
};

export const fmtDecimal = (valor: number | string | undefined, casas = 2): string => {
  const n = toNum(valor);
  if (n === null) return '-';
  return n.toFixed(casas);
};

/**
 * Código que a DI traz DENTRO da descrição da mercadoria (`... REF. MBCA1723`,
 * `PN# MBCL11222LD`). É o identificador útil para conferir a sequência da adição
 * contra o XML antes de associar o produto. Itens genéricos podem não ter → null.
 */
export const codigoDescricaoDI = (descricao: string | undefined): string | null => {
  const m = /(?:REF\.?|PN#)\s*([A-Z0-9][A-Z0-9/\-.]*)/i.exec(descricao || '');
  return m ? m[1].replace(/\.$/, '') : null;
};

/**
 * Remove o prefixo fixo "[000001] " que o Siscomex coloca no início da descrição
 * (sempre "000001", não identifica nada). No-op se já veio sem o prefixo.
 */
export const descricaoSemPrefixoDI = (descricao: string | undefined): string =>
  (descricao || '').replace(/^\s*\[\d+\]\s*/, '');

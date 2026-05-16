/**
 * Utilitários para valores monetários no padrão brasileiro (BRL).
 *
 * Uso no frontend (inputs, exibição) e helpers SQL para backend.
 *
 * Formatos suportados:
 *   BR: "1.234,56" (ponto = milhar, vírgula = decimal)
 *   US: "1234.56"  (ponto = decimal)
 */

// ============================================================
// FRONTEND — Parse (string → number)
// ============================================================

/**
 * Converte qualquer string monetária (BR ou US) para number.
 * Aceita: "R$ 1.234,56", "1234.56", "1.234,56", "180,00", "180.00", etc.
 * Retorna 0 se inválido.
 */
export function parseMonetario(valor: string | number | null | undefined): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;

  // Remove "R$", espaços, e caracteres não numéricos exceto . , -
  let limpo = String(valor).replace(/[R$\s]/g, '').trim();
  if (!limpo) return 0;

  // Detecta formato pelo último separador
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');

  if (ultimaVirgula > ultimoPonto) {
    // Formato BR: "1.234,56" → remove pontos de milhar, troca vírgula
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) {
    // Formato US com vírgula de milhar: "1,234.56" → remove vírgulas
    limpo = limpo.replace(/,/g, '');
  }
  // Caso sem vírgula: "1234.56" ou "1234" → já está OK

  const num = Number(limpo);
  return Number.isFinite(num) ? num : 0;
}

// ============================================================
// FRONTEND — Formatação (number → string)
// ============================================================

/**
 * Formata number para exibição em BRL: "R$ 1.234,56"
 */
export function formatarBRL(valor: number | string | null | undefined): string {
  const num = typeof valor === 'number' ? valor : parseMonetario(valor);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Formata number para exibição sem prefixo: "1.234,56"
 */
export function formatarDecimalBR(valor: number | string | null | undefined, casas = 2): string {
  const num = typeof valor === 'number' ? valor : parseMonetario(valor);
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(num);
}

// ============================================================
// FRONTEND — Máscara para inputs (digitação em tempo real)
// ============================================================

/**
 * Aplica máscara monetária BR durante digitação.
 * Uso: <input onChange={e => setValor(mascaraInputBRL(e.target.value))} />
 *
 * "1234"   → "12,34"
 * "123456" → "1.234,56"
 */
export function mascaraInputBRL(valor: string): string {
  // Remove tudo que não é dígito
  const soDigitos = valor.replace(/\D/g, '');
  if (!soDigitos) return '';

  // Converte para centavos e formata
  const centavos = parseInt(soDigitos, 10);
  const reais = centavos / 100;

  return formatarDecimalBR(reais);
}

/**
 * Converte valor com máscara BR de input para number.
 * "1.234,56" → 1234.56
 */
export function desmascarar(valor: string): number {
  return parseMonetario(valor);
}

// ============================================================
// BACKEND — Helpers SQL para PostgreSQL
// ============================================================

/**
 * Gera expressão SQL que converte campo JSON (que pode ter formato BR ou US)
 * para numeric seguro. Retorna 0 se NULL/vazio.
 *
 * Uso: `SELECT ${sqlSafeNumeric("i->>'preco'")} AS preco FROM ...`
 */
export function sqlSafeNumeric(expr: string): string {
  return `COALESCE((CASE WHEN position(',' in COALESCE(${expr},'')) > 0 THEN REPLACE(REPLACE(NULLIF(${expr},''), '.', ''), ',', '.')::numeric ELSE NULLIF(${expr},'')::numeric END), 0)`;
}

/**
 * Igual sqlSafeNumeric mas retorna NULL em vez de 0 (para usar em COALESCE chains).
 *
 * Uso: `COALESCE(${sqlSafeNumericNull("i->>'precoEditado'")}, ${sqlSafeNumericNull("i->>'preco'")}, 0)`
 */
export function sqlSafeNumericNull(expr: string): string {
  return `(CASE WHEN position(',' in COALESCE(${expr},'')) > 0 THEN REPLACE(REPLACE(NULLIF(${expr},''), '.', ''), ',', '.')::numeric ELSE NULLIF(${expr},'')::numeric END)`;
}

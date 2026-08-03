/**
 * Suporte ao CNPJ ALFANUMÉRICO (regra da Receita Federal, vigência 2026).
 *
 * - 14 caracteres, máscara `AA.AAA.AAA/AAAA-DV`.
 * - As **12 primeiras** posições podem ter letras `A–Z` (maiúsculas) ou dígitos `0–9`.
 * - Os **2 últimos** (DV) continuam **numéricos**.
 * - O DV usa o valor `(ASCII do caractere − 48)`: `'0'..'9'` → 0..9, `'A'..'Z'` → 17..42,
 *   com os mesmos pesos e módulo 11 do CNPJ atual.
 *
 * CNPJs 100% numéricos continuam válidos (compatível com o legado).
 */

/** Remove tudo que não for `[0-9A-Z]` (MANTÉM letras) e coloca em maiúsculas. */
export function limparDocumentoAlfa(valor?: string): string {
  return String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Valor de um caractere para o cálculo do DV: código ASCII − 48. */
function valorCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

/**
 * Valida um CNPJ numérico OU alfanumérico (DV por ASCII−48).
 * Retorna false para tamanho ≠ 14, formato inválido, repetição total ou DV incorreto.
 */
export function validarCNPJalfa(cnpj?: string): boolean {
  const doc = limparDocumentoAlfa(cnpj);
  if (doc.length !== 14) return false;
  // 12 primeiras: alfanuméricas; 2 últimas (DV): numéricas.
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(doc)) return false;
  // Rejeita repetição total (ex.: "00000000000000").
  if (/^(.)\1{13}$/.test(doc)) return false;

  const calcularDV = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acc, ch, i) => acc + valorCaractere(ch) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcularDV(doc.slice(0, 12), pesos1);
  const dv2 = calcularDV(doc.slice(0, 13), pesos2);

  return dv1 === Number(doc[12]) && dv2 === Number(doc[13]);
}

/**
 * Aplica a máscara do CNPJ alfanumérico: `AA.AAA.AAA/AAAA-DV`.
 * Mantém letras nas 12 primeiras posições; o DV aceita só dígitos.
 * (Feito caractere a caractere porque regex `\d` descartaria as letras.)
 */
export function mascaraCnpjAlfa(valor?: string): string {
  const up = String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const base = up.slice(0, 12); // 12 alfanuméricos
  const dv = up.slice(12).replace(/[^0-9]/g, '').slice(0, 2); // 2 dígitos
  const doc = base + dv;

  let out = '';
  for (let i = 0; i < doc.length; i++) {
    if (i === 2 || i === 5) out += '.';
    else if (i === 8) out += '/';
    else if (i === 12) out += '-';
    out += doc[i];
  }
  return out;
}

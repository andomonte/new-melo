// utils/validacoes.ts
import { limparDocumentoAlfa, validarCNPJalfa } from '@/utils/cnpjAlfanumerico';

/**
 * Valida se um valor é um CPF (numérico) ou CNPJ (numérico OU alfanumérico) válido.
 */
export function isValidCpfCnpj(value: string): boolean {
  const numerico = value.replace(/[^\d]+/g, '');
  const alfa = limparDocumentoAlfa(value);

  // CNPJ (14) — numérico ou alfanumérico (DV por ASCII−48)
  if (alfa.length === 14) {
    return validarCNPJalfa(alfa);
  }

  // CPF (11) — continua numérico
  if (numerico.length === 11) {
    let sum = 0;
    let rest;
    if (numerico === '00000000000') return false;
    for (let i = 1; i <= 9; i++)
      sum += parseInt(numerico.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(numerico.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++)
      sum += parseInt(numerico.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(numerico.substring(10, 11))) return false;
    return true;
  }

  return false;
}

/**
 * Valida se um email tem o formato correto.
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

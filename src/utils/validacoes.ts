// utils/validacoes.ts

/**
 * Valida se um valor é um CPF ou CNPJ válido.
 */
export function isValidCpfCnpj(value: string): boolean {
  value = value.replace(/[^\d]+/g, '');

  if (value.length === 11) {
    // Validação de CPF
    let sum = 0;
    let rest;
    if (value === '00000000000') return false;
    for (let i = 1; i <= 9; i++)
      sum += parseInt(value.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(value.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++)
      sum += parseInt(value.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(value.substring(10, 11))) return false;
    return true;
  } else if (value.length === 14) {
    // Validação de CNPJ
    let length = value.length - 2;
    let numbers = value.substring(0, length);
    const digits = value.substring(length);
    let sum = 0;
    let pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length += 1;
    numbers = value.substring(0, length);
    sum = 0;
    pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
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

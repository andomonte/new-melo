/**
 * Utilitário para validação e identificação de documentos (CPF/CNPJ)
 */

/**
 * Remove caracteres não numéricos de um documento
 */
export function limparDocumento(documento: string): string {
  return documento.replace(/\D/g, '');
}

/**
 * Identifica se o documento é CPF ou CNPJ
 * @param documento - CPF ou CNPJ (com ou sem formatação)
 * @returns 'CPF' | 'CNPJ' | null
 */
export function identificarTipoDocumento(documento: string): 'CPF' | 'CNPJ' | null {
  if (!documento) return null;
  
  const docLimpo = limparDocumento(documento);
  
  if (docLimpo.length === 11) return 'CPF';
  if (docLimpo.length === 14) return 'CNPJ';
  
  return null;
}

/**
 * Valida CPF
 * @param cpf - CPF com ou sem formatação
 * @returns boolean
 */
export function validarCPF(cpf: string): boolean {
  const cpfLimpo = limparDocumento(cpf);
  
  if (cpfLimpo.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
  
  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const digito1 = resto === 10 || resto === 11 ? 0 : resto;
  
  if (digito1 !== parseInt(cpfLimpo.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  const digito2 = resto === 10 || resto === 11 ? 0 : resto;
  
  if (digito2 !== parseInt(cpfLimpo.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ
 * @param cnpj - CNPJ com ou sem formatação
 * @returns boolean
 */
export function validarCNPJ(cnpj: string): boolean {
  const cnpjLimpo = limparDocumento(cnpj);
  
  if (cnpjLimpo.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;
  
  // Validação do primeiro dígito verificador
  let tamanho = cnpjLimpo.length - 2;
  let numeros = cnpjLimpo.substring(0, tamanho);
  const digitos = cnpjLimpo.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  // Validação do segundo dígito verificador
  tamanho = tamanho + 1;
  numeros = cnpjLimpo.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
}

/**
 * Valida documento (CPF ou CNPJ)
 * @param documento - CPF ou CNPJ com ou sem formatação
 * @returns boolean
 */
export function validarDocumento(documento: string): boolean {
  const tipo = identificarTipoDocumento(documento);
  
  if (tipo === 'CPF') return validarCPF(documento);
  if (tipo === 'CNPJ') return validarCNPJ(documento);
  
  return false;
}

/**
 * Formata CPF
 * @param cpf - CPF sem formatação
 * @returns CPF formatado (000.000.000-00)
 */
export function formatarCPF(cpf: string): string {
  const cpfLimpo = limparDocumento(cpf);
  return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ
 * @param cnpj - CNPJ sem formatação
 * @returns CNPJ formatado (00.000.000/0000-00)
 */
export function formatarCNPJ(cnpj: string): string {
  const cnpjLimpo = limparDocumento(cnpj);
  return cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata documento (CPF ou CNPJ)
 * @param documento - CPF ou CNPJ sem formatação
 * @returns Documento formatado
 */
export function formatarDocumento(documento: string): string {
  const tipo = identificarTipoDocumento(documento);
  
  if (tipo === 'CPF') return formatarCPF(documento);
  if (tipo === 'CNPJ') return formatarCNPJ(documento);
  
  return documento;
}

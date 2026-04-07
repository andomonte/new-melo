/**
 * Utilitários para manipulação de chave NFe / importacao
 */

import { CHAVE_MIN_LENGTH, CHAVE_MAX_LENGTH } from '../constants';

/**
 * Detecta se a chave eh de importacao (prefixo IMP)
 */
export const isChaveImportacao = (valor: string): boolean => {
  return valor.trim().toUpperCase().startsWith('IMP');
};

/**
 * Limpa e formata a chave de entrada.
 * Para chaves IMP: preserva o prefixo e remove caracteres invalidos.
 * Para chaves normais: remove tudo que nao eh digito.
 */
export const limparChave = (valor: string): string => {
  const trimmed = valor.trim();
  if (isChaveImportacao(trimmed)) {
    // Preservar prefixo IMP + apenas digitos depois
    const semPrefixo = trimmed.slice(3).replace(/\D/g, '');
    return ('IMP' + semPrefixo).slice(0, CHAVE_MAX_LENGTH);
  }
  return trimmed.replace(/\D/g, '').slice(0, CHAVE_MAX_LENGTH);
};

/**
 * Valida se a chave eh valida (NFe 44 digitos ou importacao com IMP + digitos)
 */
export const validarChaveNFe = (chave: string): boolean => {
  if (isChaveImportacao(chave)) {
    // IMP + pelo menos 20 digitos
    const digitos = chave.slice(3).replace(/\D/g, '');
    return digitos.length >= 20;
  }
  const chaveLimpa = chave.replace(/\D/g, '');
  return chaveLimpa.length >= CHAVE_MIN_LENGTH;
};

/**
 * Formata a chave para exibição
 */
export const formatarChaveExibicao = (chave: string): string => {
  return limparChave(chave);
};

// Manter para compatibilidade
export const extrairNumeros = limparChave;

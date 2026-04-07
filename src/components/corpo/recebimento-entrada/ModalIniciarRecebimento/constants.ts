/**
 * Constantes do Modal de Iniciar Recebimento
 */

export const CHAVE_NFE_LENGTH = 44;
export const CHAVE_MIN_LENGTH = 30;
export const CHAVE_MAX_LENGTH = 50;

export const MODAL_MODES = {
  MANUAL: 'manual',
  BARCODE: 'barcode',
} as const;

export type ModalMode = typeof MODAL_MODES[keyof typeof MODAL_MODES];

export const PLACEHOLDERS = {
  INPUT_CHAVE: 'Digite a chave da NFe ou chave de importacao',
  SCANNER_ATIVO: 'Escaneie o código de barras da NFe',
  SCANNER_INATIVO: 'Clique aqui para ativar',
} as const;

export const MESSAGES = {
  CHAVE_INVALIDA: 'A chave deve ter pelo menos 30 digitos numericos.',
  RECEBIMENTO_INICIADO: 'NFe localizada e recebimento iniciado com sucesso.',
  ERRO_GENERICO: 'Erro ao iniciar recebimento. Verifique a chave da NFe.',
} as const;

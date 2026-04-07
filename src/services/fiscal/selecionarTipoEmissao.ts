/**
 * Service para selecionar automaticamente o tipo de emissão fiscal
 * com base no documento do destinatário (CPF ou CNPJ)
 */

import { identificarTipoDocumento } from '@/utils/validarDocumento';

export type TipoEmissaoFiscal = 'NFE' | 'NFCE';
export type ModeloDocumentoFiscal = '55' | '65';

export interface ResultadoSelecaoEmissao {
  tipoEmissao: TipoEmissaoFiscal;
  modelo: ModeloDocumentoFiscal;
  descricao: string;
  endpoint: string;
}

/**
 * Seleciona o tipo de emissão fiscal baseado no documento do destinatário
 * 
 * Regras:
 * - CNPJ → NF-e (Nota Fiscal Eletrônica) - Modelo 55
 * - CPF → NFC-e (Nota Fiscal de Consumidor Eletrônica / Cupom Fiscal) - Modelo 65
 * 
 * @param documentoDestinatario - CPF ou CNPJ do destinatário
 * @returns ResultadoSelecaoEmissao
 */
export function selecionarTipoEmissao(documentoDestinatario: string): ResultadoSelecaoEmissao {
  const tipoDocumento = identificarTipoDocumento(documentoDestinatario);
  
  if (tipoDocumento === 'CNPJ') {
    return {
      tipoEmissao: 'NFE',
      modelo: '55',
      descricao: 'Nota Fiscal Eletrônica (NF-e)',
      endpoint: '/api/faturamento/emitir'
    };
  }
  
  // CPF ou documento não identificado → NFC-e (Cupom Fiscal)
  return {
    tipoEmissao: 'NFCE',
    modelo: '65',
    descricao: 'Nota Fiscal de Consumidor Eletrônica (NFC-e / Cupom Fiscal)',
    endpoint: '/api/faturamento/emitir-cupom'
  };
}

/**
 * Verifica se deve emitir NF-e
 */
export function deveEmitirNFe(documentoDestinatario: string): boolean {
  return selecionarTipoEmissao(documentoDestinatario).tipoEmissao === 'NFE';
}

/**
 * Verifica se deve emitir NFC-e (Cupom Fiscal)
 */
export function deveEmitirNFCe(documentoDestinatario: string): boolean {
  return selecionarTipoEmissao(documentoDestinatario).tipoEmissao === 'NFCE';
}

/**
 * Obtém o modelo do documento fiscal baseado no tipo de documento
 */
export function obterModeloDocumento(documentoDestinatario: string): ModeloDocumentoFiscal {
  return selecionarTipoEmissao(documentoDestinatario).modelo;
}

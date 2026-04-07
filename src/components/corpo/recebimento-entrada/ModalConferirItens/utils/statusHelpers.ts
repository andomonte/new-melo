/**
 * Helpers para manipulacao de status e calculos
 */

import { StatusItem, ItemLocal, ResumoItens } from '../constants';

/**
 * Calcula o resumo dos itens por status
 */
export const calcularResumo = (itens: ItemLocal[]): ResumoItens => {
  return {
    total: itens.length,
    ok: itens.filter(i => i.statusLocal === 'OK').length,
    falta: itens.filter(i => i.statusLocal === 'FALTA').length,
    excesso: itens.filter(i => i.statusLocal === 'EXCESSO').length,
    danificado: itens.filter(i => i.statusLocal === 'DANIFICADO').length,
    errado: itens.filter(i => i.statusLocal === 'ERRADO').length,
    pendente: itens.filter(i => i.statusLocal === 'PENDENTE').length,
  };
};

/**
 * Determina o status automaticamente baseado na quantidade
 */
export const determinarStatusPorQuantidade = (
  qtdRecebida: number,
  qtdEsperada: number
): StatusItem => {
  if (qtdRecebida === qtdEsperada) {
    return 'OK';
  } else if (qtdRecebida < qtdEsperada) {
    return 'FALTA';
  } else {
    return 'EXCESSO';
  }
};

/**
 * Verifica se ha itens pendentes
 */
export const temItensPendentes = (itens: ItemLocal[]): boolean => {
  return itens.some(i => i.statusLocal === 'PENDENTE');
};

/**
 * Verifica se ha itens modificados nao salvos
 */
export const temItensModificados = (itens: ItemLocal[]): boolean => {
  return itens.some(i => i.modificado);
};

/**
 * Verifica se pode finalizar (todos conferidos e salvos)
 */
export const podeFinalizar = (itens: ItemLocal[]): boolean => {
  return !temItensPendentes(itens) && !temItensModificados(itens);
};

/**
 * Conta itens modificados
 */
export const contarModificados = (itens: ItemLocal[]): number => {
  return itens.filter(i => i.modificado).length;
};

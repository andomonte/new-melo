/**
 * Fonte da Venda Externa: online quando há internet (dados na hora), local (pacote do
 * aparelho) quando não há — e cai para a local se a rede falhar no meio da consulta.
 */
import { fonteOnline, type FonteVenda } from './fonteOnline';
import { fonteLocal } from './fonteLocal';

const ehFalhaDeRede = (e: any) => !e?.response; // axios sem resposta = sem conexão/timeout

function hibrida<K extends keyof FonteVenda>(nome: K): FonteVenda[K] {
  return (async (...args: any[]) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return (fonteLocal[nome] as any)(...args);
    try {
      return await (fonteOnline[nome] as any)(...args);
    } catch (e) {
      if (ehFalhaDeRede(e)) return (fonteLocal[nome] as any)(...args);
      throw e;
    }
  }) as any;
}

export const fonte: FonteVenda = {
  buscarClientes: hibrida('buscarClientes'),
  buscarProdutos: hibrida('buscarProdutos'),
  formasPagamento: hibrida('formasPagamento'),
  opcoesPrazo: hibrida('opcoesPrazo'),
  validarCredito: hibrida('validarCredito'),
  precos: hibrida('precos'),
  impostosItem: hibrida('impostosItem'),
};

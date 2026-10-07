/**
 * Hook para gerenciar o modal de novo contrato de câmbio
 */

import { useState } from 'react';
import type { ContratoCambio } from '../types/importacao';

const CONTRATO_INICIAL: Partial<ContratoCambio> = { moeda: 'USD' };

export function useContratoModal(onAdd: (contrato: ContratoCambio) => void) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Partial<ContratoCambio>>(CONTRATO_INICIAL);

  const abrir = () => setAberto(true);

  const fechar = () => {
    setAberto(false);
    setForm(CONTRATO_INICIAL);
  };

  const atualizarCampo = (campo: keyof ContratoCambio, valor: string | number) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const salvar = () => {
    if (!form.contrato || !form.vl_merc_dolar || !form.taxa_dolar) return;

    onAdd({
      id_importacao: 0,
      data: form.data || '',
      taxa_dolar: form.taxa_dolar,
      vl_merc_dolar: form.vl_merc_dolar,
      vl_reais: form.vl_reais,
      contrato: form.contrato,
      moeda: form.moeda || 'USD',
    });

    fechar();
  };

  const podesSalvar = !!(form.contrato && form.vl_merc_dolar && form.taxa_dolar);

  return { aberto, form, abrir, fechar, atualizarCampo, salvar, podesSalvar };
}

export function useContratosTotais(contratos: ContratoCambio[], taxaDolarMedio?: number) {
  // USD por contrato: usa vl_usd (já convertido via BRL). Contrato estrangeiro sem
  // taxa do dólar ainda não contribui para o total em dólar (fica pendente de taxa).
  const totalUSD = contratos.reduce(
    (s, c) => s + (c.vl_usd ?? (c.moeda && c.moeda !== 'USD' ? 0 : c.vl_merc_dolar || 0)),
    0,
  );
  // BRL: usa vl_reais se existir, senão calcula taxa (moeda→BRL) × valor
  const totalBRL = contratos.reduce(
    (s, c) => s + (c.vl_reais ?? (c.vl_merc_dolar || 0) * (c.taxa_dolar || 0)),
    0,
  );

  const dolarMedio =
    taxaDolarMedio ??
    (contratos.length > 0 && totalUSD > 0 ? totalBRL / totalUSD : 0);

  // Contratos que ainda precisam de taxa do dólar p/ converter em USD
  const pendentesTaxa = contratos.filter(
    (c) => (c.moeda && c.moeda !== 'USD') && (c.vl_usd == null || !c.taxa_usd),
  ).length;

  return { totalUSD, totalBRL, dolarMedio, pendentesTaxa };
}

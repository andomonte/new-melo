/**
 * Enriquecimento da Taxa Dólar dos contratos de câmbio a partir do Contas a Pagar.
 *
 * Fonte primária da taxa: um título no Contas a Pagar com o mesmo nº de contrato.
 * - A taxa do título (taxa_conversao) é a taxa da MOEDA do contrato -> BRL (Taxa Câmbio).
 * - Só é a "Taxa Dólar" quando o contrato é em USD; aí origem = CAP.
 * - Para moeda estrangeira, o Contas a Pagar não fornece a taxa do dólar; a Taxa Dólar
 *   permanece a do XML (origem XML) até o usuário buscar PTAX ou digitar.
 */

import api from '@/components/services/api';
import type { ContratoCambio } from '../types/importacao';

export interface CapTaxaInfo {
  id_titulo: number | string;
  moeda: string | null;
  taxa_conversao: number | null;
  valor_moeda: number | null;
  data_ref?: string | null; // data do título (pgto/emissão) p/ cotação do mesmo dia
}

/** Consulta o Contas a Pagar pelos números de contrato. Nunca lança. */
export async function buscarTaxasContrato(
  numeros: string[],
): Promise<Record<string, CapTaxaInfo>> {
  const lista = Array.from(new Set(numeros.filter(Boolean)));
  if (lista.length === 0) return {};
  try {
    const res = await api.get(
      `/api/contas-pagar/taxa-contrato?contratos=${encodeURIComponent(lista.join(','))}`,
    );
    return (res.data?.map || {}) as Record<string, CapTaxaInfo>;
  } catch {
    return {};
  }
}

/** Recalcula vl_reais e vl_usd de um contrato a partir das taxas atuais. */
export function recalcularContrato(c: ContratoCambio): ContratoCambio {
  const moeda = c.moeda || 'USD';
  const valor = c.vl_merc_dolar || 0;
  const vlReais = c.taxa_dolar ? valor * c.taxa_dolar : (c.vl_reais ?? undefined);
  let vlUsd: number | undefined;
  if (moeda === 'USD') vlUsd = valor;
  else if (c.taxa_usd && c.taxa_usd > 0 && vlReais != null) vlUsd = vlReais / c.taxa_usd;
  return { ...c, vl_reais: vlReais, vl_usd: vlUsd };
}

/**
 * Aplica as taxas do Contas a Pagar aos contratos.
 * `respeitarUsuario` = true não sobrescreve Taxa Dólar marcada como MANUAL/PTAX.
 */
export function aplicarTaxasCap(
  contratos: ContratoCambio[],
  capMap: Record<string, CapTaxaInfo>,
  respeitarUsuario = true,
): ContratoCambio[] {
  return contratos.map((c) => {
    const cap = capMap[c.contrato];
    if (!cap) return recalcularContrato(c);

    const next: ContratoCambio = { ...c };
    const moeda = next.moeda || 'USD';
    const fixada = (o?: string) => o === 'MANUAL' || o === 'PTAX' || o === 'MERCADO';
    const cambioFixado = respeitarUsuario && fixada(next.origem_cambio);
    const dolarFixado = respeitarUsuario && fixada(next.origem_taxa);

    // Vincula o título encontrado
    if (!next.id_titulo_pagar && cap.id_titulo != null) {
      const n = Number(cap.id_titulo);
      if (!isNaN(n)) next.id_titulo_pagar = n;
    }

    // Data do câmbio = data do título (p/ buscar o dólar PTAX do MESMO dia depois)
    if (cap.data_ref && !next.data) next.data = cap.data_ref;

    // Taxa Câmbio (moeda -> BRL): Contas a Pagar é a fonte autoritativa (dia do pagamento)
    if (!cambioFixado && cap.taxa_conversao && cap.taxa_conversao > 0) {
      next.taxa_dolar = cap.taxa_conversao;
      next.origem_cambio = 'CAP';
    }

    // Taxa Dólar: só vem do Contas a Pagar quando o contrato é USD
    if (!dolarFixado && moeda === 'USD' && cap.taxa_conversao && cap.taxa_conversao > 0) {
      next.taxa_usd = cap.taxa_conversao;
      next.origem_taxa = 'CAP';
    }

    return recalcularContrato(next);
  });
}

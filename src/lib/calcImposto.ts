// src/lib/calcImposto.ts
export type Cards = {
  valorIPI: number;
  valorICMS: number;
  valorICMS_Subst: number;
  valorPIS: number;
  valorCOFINS: number;
  totalImpostos: number; // somatório na MESMA escala da base do motor (não é R$ do item)
};

export type Aliquotas = {
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  agregado: number;
};

// Percentuais efetivos (sobre a base do motor)
export type CardsPercent = {
  percIPI: number;
  percICMS: number;
  percICMS_Subst: number;
  percPIS: number;
  percCOFINS: number;
  percTotal: number;
};

// Valores em R$ PARA O ITEM do carrinho (baseados no subtotal do item)
export type ImpostosItemRS = {
  valorIPI: number;
  valorICMS: number;
  valorICMS_Subst: number;
  valorPIS: number;
  valorCOFINS: number;
  valorImpostos: number; // soma em R$
  totalComImpostos: number; // subtotalItem + valorImpostos
};

export type CalcImpostoParams = {
  tipoMovimentacao: 'SAIDA' | 'ENTRADA';
  tipoOperacao: 'VENDA' | 'DEVOLUCAO' | 'TRANSFERENCIA';
  tipoFatura: 'NOTA_FISCAL' | 'CUPOM';
  zerarSubstituicao: 'N' | 'S';
  codProd: string;
  codCli: string;

  /**
   * Quantidade e valor unitário podem vir como string ("01,5") ou number.
   * Se usarAuto=true, o total do item será calculado como quantidade × valorUnitario.
   * Se usarAuto=false, você deve informar totalItem.
   */
  quantidade: number | string;
  valorUnitario: number | string;
  usarAuto: boolean;
  totalItem?: number | string; // usado apenas quando usarAuto=false
  uf_empresa?: string;
};

export type CalcImpostoResult = {
  // Já existiam:
  cards: Cards; // valores na base do motor (não R$ do item)
  aliquotas: Aliquotas;
  debug: any;
  raw: any;
  // Novos (opcionais, para facilitar o consumo no carrinho/telas):
  subtotalItem?: number; // subtotal usado para monetização
  cardsPercent?: CardsPercent; // percentuais efetivos derivados da base
  impostosRs?: ImpostosItemRS; // valores em R$ do item + total com impostos
};

/** Converte string/number PT-BR/EN → number com heurística segura */
const toN = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // mantém apenas dígitos, vírgula, ponto e sinal
  s = s.replace(/[^\d,.\-]/g, '');
  const hasC = s.includes(','),
    hasD = s.includes('.');
  if (hasC && hasD) {
    // último separador encontrado define o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // BR: 1.234,56 -> 1234.56
    } else {
      s = s.replace(/,/g, ''); // EN: 1,234.56 -> 1234.56
    }
  } else if (hasC) {
    s = s.replace(',', '.'); // "2,51" -> "2.51"
  } // só ponto -> ok
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza a resposta do backend para shape estável */
function normalizeApiResponse(r: any): {
  cards: Cards;
  aliquotas: Aliquotas;
  debug: any;
} {
  const cardsSrc = r?.cards ?? r?.resultados ?? r ?? {};
  const aliqSrc =
    r?.debug?.aliquotas ?? r?.aliquotas ?? r?.debug?.aliq ?? r?.aliq ?? {};

  const cards: Cards = {
    valorIPI: toN(cardsSrc.valorIPI ?? cardsSrc.ipi),
    valorICMS: toN(cardsSrc.valorICMS ?? cardsSrc.icms),
    valorICMS_Subst: toN(cardsSrc.valorICMS_Subst ?? cardsSrc.icmsst ?? 0),
    valorPIS: toN(cardsSrc.valorPIS ?? cardsSrc.pis),
    valorCOFINS: toN(cardsSrc.valorCOFINS ?? cardsSrc.cofins),
    totalImpostos: toN(cardsSrc.totalImpostos ?? cardsSrc.total ?? 0),
  };

  const aliquotas: Aliquotas = {
    icms: toN(aliqSrc.icms),
    ipi: toN(aliqSrc.ipi),
    pis: toN(aliqSrc.pis),
    cofins: toN(aliqSrc.cofins),
    agregado: toN(aliqSrc.agregado),
  };

  const debug = r?.debug ?? r;
  return { cards, aliquotas, debug };
}

/** Subtotal do item (em R$) com base em params */
function getSubtotalFromParams(p: CalcImpostoParams): number {
  const q = toN(p.quantidade);
  const vu = toN(p.valorUnitario);
  if (p.usarAuto) return +(q * vu).toFixed(2);
  // quando usarAuto=false, confie em totalItem; se vier vazio, fallback para q*vu
  const ti = toN(p.totalItem);
  return ti > 0 ? +ti.toFixed(2) : +(q * vu).toFixed(2);
}

/**
 * Função pura para cálculo de impostos.
 * Recebe todos os dados via params e devolve JSON normalizado + percentuais e valores em R$ do item.
 * Lança erro (Exception) se a resposta não for OK.
 */
export async function calcImposto(
  params: CalcImpostoParams,
): Promise<CalcImpostoResult> {
  const payload = {
    tipoMovimentacao: params.tipoMovimentacao,
    tipoOperacao: params.tipoOperacao,
    tipoFatura: params.tipoFatura,
    zerarSubstituicao: params.zerarSubstituicao,
    codProd: (params.codProd || '').trim(),
    codCli: (params.codCli || '').trim(),
    quantidade: toN(params.quantidade),
    valorUnitario: toN(params.valorUnitario),
    totalItem: params.usarAuto ? undefined : toN(params.totalItem),
    usarAuto: !!params.usarAuto,

    ...(params.uf_empresa ? { uf_empresa: params.uf_empresa.trim() } : {}),
  };

  const res = await fetch('/api/impostos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? 'Erro no cálculo';
    throw new Error(msg);
  }

  // Normaliza resposta do motor (cards/aliquotas em shape estável)
  const norm = normalizeApiResponse(data);

  // Subtotal do item (R$)
  const subtotalItem = getSubtotalFromParams(params);

  // Valores em R$ do item vêm DIRETO da API (função PG calcular_imposto_item),
  // que já calcula para quantidade × valorUnitário. Sem monetização/derivação em JS.
  const valorIPI = toN(data?.valores?.totalipi ?? data?.campos?.totalipi ?? 0);
  const valorICMS = toN(data?.valores?.totalicms ?? data?.campos?.totalicms ?? 0);
  const valorICMS_Subst = toN(
    data?.valores?.totalsubst_trib ?? data?.campos?.totalsubst_trib ?? 0,
  );
  const valorPIS = toN(data?.valores?.valorpis ?? data?.campos?.valorpis ?? 0);
  const valorCOFINS = toN(data?.valores?.valorcofins ?? data?.campos?.valorcofins ?? 0);
  // "Total c/ Imposto" = o valor que o cliente REALMENTE paga.
  // Só somam os tributos "POR FORA" (que aumentam o valor a pagar e entram no VALOR DA
  // NOTA): IPI + ICMS-ST. ICMS/PIS/COFINS são "por dentro" (já embutidos no preço) —
  // ficam disponíveis no objeto (tooltip informativo) mas NÃO somam ao total.
  const valorImpostos = +(valorIPI + valorICMS_Subst).toFixed(2);

  const impostosRs: ImpostosItemRS = {
    valorIPI,
    valorICMS,
    valorICMS_Subst,
    valorPIS,
    valorCOFINS,
    valorImpostos,
    totalComImpostos: +(subtotalItem + valorImpostos).toFixed(2),
  };

  // Percentuais efetivos = alíquotas retornadas pela API (não recalcular a partir da base).
  const cardsPercent: CardsPercent = {
    percIPI: norm.aliquotas.ipi,
    percICMS: norm.aliquotas.icms,
    percICMS_Subst: norm.aliquotas.agregado,
    percPIS: norm.aliquotas.pis,
    percCOFINS: norm.aliquotas.cofins,
    percTotal:
      norm.aliquotas.ipi +
      norm.aliquotas.icms +
      norm.aliquotas.pis +
      norm.aliquotas.cofins,
  };

  return {
    cards: norm.cards,
    aliquotas: norm.aliquotas,
    debug: norm.debug,
    raw: data,
    subtotalItem,
    cardsPercent,
    impostosRs,
  };
}

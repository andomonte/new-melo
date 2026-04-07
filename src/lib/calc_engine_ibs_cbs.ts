// src/lib/calc_engine_ibs_cbs.ts
// NOVA LEGISLAÇÃO IBS/CBS - Mantém interface compatível com calcImposto

export type Cards = {
  valorIBS: number;
  valorCBS: number;
  totalImpostos: number;
  // Compatibilidade
  valorIPI: number;
  valorICMS: number;
  valorICMS_Subst: number;
  valorPIS: number;
  valorCOFINS: number;
};

export type Aliquotas = {
  ibs: number;
  cbs: number;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  agregado: number;
};

export type CardsPercent = {
  percIBS: number;
  percCBS: number;
  percTotal: number;
  percIPI: number;
  percICMS: number;
  percICMS_Subst: number;
  percPIS: number;
  percCOFINS: number;
};

export type ImpostosItemRS = {
  valorIBS: number;
  valorCBS: number;
  valorImpostos: number;
  totalComImpostos: number;
  valorIPI: number;
  valorICMS: number;
  valorICMS_Subst: number;
  valorPIS: number;
  valorCOFINS: number;
};

export type CalcImpostoParams = {
  tipoMovimentacao: 'SAIDA' | 'ENTRADA';
  tipoOperacao: 'VENDA' | 'DEVOLUCAO' | 'TRANSFERENCIA';
  tipoFatura: 'NOTA_FISCAL' | 'CUPOM';
  zerarSubstituicao: 'N' | 'S';
  codProd: string;
  codCli: string;
  quantidade: number | string;
  valorUnitario: number | string;
  usarAuto: boolean;
  totalItem?: number | string;
  uf_empresa?: string;
};

export type CalcImpostoResult = {
  cards: Cards;
  aliquotas: Aliquotas;
  debug: any;
  raw: any;
  subtotalItem?: number;
  cardsPercent?: CardsPercent;
  impostosRs?: ImpostosItemRS;
  // Campos completos para salvar na dbitvenda
  campos?: {
    icms: number;
    baseicms: number;
    totalicms: number;
    icmsinterno_dest: number;
    icmsexterno_orig: number;
    csticms: string;
    mva: number;
    basesubst_trib: number;
    totalsubst_trib: number;
    ipi: number;
    baseipi: number;
    totalipi: number;
    cstipi: string;
    pis: number;
    basepis: number;
    valorpis: number;
    cstpis: string;
    cofins: number;
    basecofins: number;
    valorcofins: number;
    cstcofins: string;
    fcp: number;
    base_fcp: number;
    valor_fcp: number;
    fcp_subst: number;
    basefcp_subst: number;
    valorfcp_subst: number;
    cfop: string;
    tipocfop: string;
    ncm: string;
    totalproduto: number;
  };
};

const toN = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[^\d,.\-]/g, '');
  const hasC = s.includes(','),
    hasD = s.includes('.');
  if (hasC && hasD) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasC) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function getSubtotalFromParams(p: CalcImpostoParams): number {
  const q = toN(p.quantidade);
  const vu = toN(p.valorUnitario);
  if (p.usarAuto) return +(q * vu).toFixed(2);
  const ti = toN(p.totalItem);
  return ti > 0 ? +ti.toFixed(2) : +(q * vu).toFixed(2);
}

/**
 * FUNÇÃO PRINCIPAL - Calcula TODOS os impostos (ICMS, ST, IPI, PIS, COFINS, FCP, IBS/CBS)
 * Chama /api/impostos que usa CalculadoraImpostos com cálculos completos e precisos
 * IBS/CBS são informativos em 2026 e não somam no total
 */
export async function calcularIBSCBS(
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

  // Chama API de impostos COMPLETOS (não só IBS/CBS)
  const res = await fetch('/api/impostos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  console.log('📡 Resposta da API /api/impostos:', {
    status: res.status,
    ok: res.ok,
    data: data,
    valores: data?.valores,
    aliquotas: data?.aliquotas,
    campos: data?.campos
  });

  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? 'Erro no cálculo de impostos';
    console.error('❌ API retornou erro:', msg, data);
    throw new Error(msg);
  }

  const subtotalItem = getSubtotalFromParams(params);

  // Extrai todos os impostos da resposta
  const aliqICMS = toN(data?.aliquotas?.icms ?? 0);
  const aliqIPI = toN(data?.aliquotas?.ipi ?? 0);
  const aliqPIS = toN(data?.aliquotas?.pis ?? 0);
  const aliqCOFINS = toN(data?.aliquotas?.cofins ?? 0);
  const aliqIBS = toN(data?.aliquotas?.ibs ?? 0);
  const aliqCBS = toN(data?.aliquotas?.cbs ?? 0);

  // Valores em R$
  const valorICMS = toN(data?.valores?.totalicms ?? 0);
  const valorST = toN(data?.valores?.totalsubst_trib ?? 0);
  const valorIPI = toN(data?.valores?.totalipi ?? 0);
  const valorPIS = toN(data?.valores?.valorpis ?? 0);
  const valorCOFINS = toN(data?.valores?.valorcofins ?? 0);
  const valorFCP = toN(data?.valores?.valor_fcp ?? 0);
  const valorFCPST = toN(data?.valores?.valorfcp_subst ?? 0);
  const valorIBS = toN(data?.valores?.ibs_valor ?? 0);
  const valorCBS = toN(data?.valores?.cbs_valor ?? 0);

  // Total de impostos REAIS (sem IBS/CBS que são informativos em 2026)
  const totalImpostosReais = valorICMS + valorST + valorIPI + valorPIS + valorCOFINS + valorFCP + valorFCPST;

  const cards: Cards = {
    valorIPI: aliqIPI,
    valorICMS: aliqICMS,
    valorICMS_Subst: valorST, // valor em R$
    valorPIS: aliqPIS,
    valorCOFINS: aliqCOFINS,
    totalImpostos: aliqICMS + aliqIPI + aliqPIS + aliqCOFINS,
    valorIBS: aliqIBS, // Informativo 2026
    valorCBS: aliqCBS, // Informativo 2026
  };

  const aliquotas: Aliquotas = {
    icms: aliqICMS,
    ipi: aliqIPI,
    pis: aliqPIS,
    cofins: aliqCOFINS,
    agregado: toN(data?.aliquotas?.agregado ?? 0),
    ibs: aliqIBS, // Informativo 2026
    cbs: aliqCBS, // Informativo 2026
  };

  const cardsPercent: CardsPercent = {
    percIBS: aliqIBS,
    percCBS: aliqCBS,
    percTotal: aliqICMS + aliqIPI + aliqPIS + aliqCOFINS,
    percIPI: aliqIPI,
    percICMS: aliqICMS,
    percICMS_Subst: valorST, // valor em R$
    percPIS: aliqPIS,
    percCOFINS: aliqCOFINS,
  };

  const impostosRs: ImpostosItemRS = {
    valorIBS, // Informativo 2026 (não soma no total)
    valorCBS, // Informativo 2026 (não soma no total)
    valorImpostos: totalImpostosReais,
    totalComImpostos: subtotalItem + totalImpostosReais,
    valorIPI,
    valorICMS,
    valorICMS_Subst: valorST,
    valorPIS,
    valorCOFINS,
  };

  return {
    cards,
    aliquotas,
    debug: data?.debug ?? {},
    raw: data,
    subtotalItem,
    cardsPercent,
    impostosRs,
    // Adiciona campos completos para salvar na dbitvenda
    campos: data?.campos,
  };
}

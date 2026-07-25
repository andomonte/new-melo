/**
 * Motor de custo de entrada — porte fiel de ENTRADASEFAZ.CalculaPrCusto (Oracle/Delphi).
 *
 * Parte DETERMINÍSTICA: a partir de um item de entrada + a entrada + o produto + a
 * zona fiscal da empresa, calcula os 6 custos por unidade gravados em dbitent:
 *   prcusto (dentro do estado), prcusto_contabil, prcusto_fe (fora do estado),
 *   prcusto_zf (zona franca), prtransferencia_liquido, prtransferencia_bruto.
 *
 * Validado item a item contra o Oracle (11.791 itens dos últimos 12 meses):
 *   prcusto / prcusto_contabil / prcusto_fe / prcusto_zf = 100% exato;
 *   transferências = 100% exceto onde o insumo do produto (prtransf/dolar) mudou
 *   após a entrada original (drift de snapshot, fora do controle da fórmula).
 *
 * NÃO inclui a média ponderada (CALCULAR_MEDIO), que depende do estoque/custo vivo
 * do produto e grava em dbprod/dbprod_custo/dbprod_contabil — ver custoMedio.ts (Fase D).
 */

/** ROUND do Oracle: half-away-from-zero, com epsilon p/ neutralizar ruído de ponto-flutuante. */
export function round(x: number | null | undefined, n = 0): number {
  if (x === null || x === undefined || Number.isNaN(x)) return 0;
  const f = Math.pow(10, n);
  const v = x * f;
  const sign = v >= 0 ? 1 : -1;
  const r = Math.floor(Math.abs(v) + 0.5 + 1e-9);
  return (sign * r) / f;
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nvl = <T,>(v: T | null | undefined, d: T): T => (v === null || v === undefined ? d : v);

export interface ItemEntradaCusto {
  prunit: number;
  prunitnf?: number | null;
  quant: number;
  quantnf: number;
  totalicmsdesconto?: number | null;
  valor_ipi?: number | null;
  valor_icms_subst?: number | null;
  pis?: number | null;
  cofins?: number | null;
  fis_icmsdeson?: number | null;
  prtransf?: number | null;
}

export interface EntradaCusto {
  custofin?: number | null;
  desconto?: number | null;
  verba_tmk?: number | null;
  acrescimo?: number | null;
}

export interface ProdutoCusto {
  isentoipi?: string | null;
  ipi?: number | null;
  dolar?: string | null;
}

export interface EmpresaZona {
  uf: string;
  /** 'S' = zona incentivada (ZFM), 'N' = não incentivada. */
  zona_isentivada: string;
}

export interface CustosItem {
  prcusto: number;
  prcusto_contabil: number;
  prcusto_fe: number;
  prcusto_zf: number;
  prtransferencia_liquido: number;
  prtransferencia_bruto: number;
}

/**
 * Frete unitário-base rateado a partir do conhecimento de transporte.
 * Espelha: if Cif='N' then Frete := (TotalCon + STCon) / TotalTransp.
 * Retorna 0 quando não há conhecimento (temcon <> 'S') ou frete é CIF do fornecedor (Cif='S').
 */
export function freteConhecimento(con: {
  cif?: string | null;
  totaltransp?: number | null;
  totalcon?: number | null;
  stcon?: number | null;
} | null | undefined): number {
  if (!con || con.cif !== 'N') return 0;
  const totalTransp = num(con.totaltransp);
  if (totalTransp === 0) return 0;
  return (num(con.totalcon) + num(con.stcon)) / totalTransp;
}

/**
 * Calcula os custos por unidade de UM item de entrada.
 * @param frete frete unitário-base (use freteConhecimento); 0 se não houver.
 */
export function calcularCustoItem(
  it: ItemEntradaCusto,
  ent: EntradaCusto,
  prod: ProdutoCusto,
  empresa: EmpresaZona,
  frete = 0
): CustosItem {
  const Quant = num(it.quant);
  const Prunit = num(it.prunit);
  const PrUnit = Prunit;
  const PrUnitNF = it.prunitnf === null || it.prunitnf === undefined ? Prunit : num(it.prunitnf);
  const CustoFin = num(ent.custofin);
  const Frete = num(frete);

  const vVlrDesconto_ICMS = num(it.totalicmsdesconto) > 0 ? num(it.totalicmsdesconto) / Quant : 0;
  const VlrDesconto = (Prunit * num(nvl(ent.desconto, 0))) / 100;
  const VlrAcrescimo = (Prunit * num(nvl(ent.acrescimo, 0))) / 100;
  const VlrIpi = num(it.valor_ipi) > 0 ? num(it.valor_ipi) / Quant : 0;
  const Vlr_Subst = num(it.valor_icms_subst) > 0 ? round(num(it.valor_icms_subst) / Quant, 2) : 0;
  const vValor_MK = (PrUnitNF * num(nvl(ent.verba_tmk, 0))) / 100;
  const xValor_PIS = num(nvl(it.pis, 0)) / Quant;
  const xValor_Cofins = num(nvl(it.cofins, 0)) / Quant;

  // Frete: usa Prunit (VlrCusto ainda não foi reatribuído neste ponto no Oracle)
  const xVlrFrete = Frete * (num(it.quantnf) / Quant);
  const VlrFrete =
    (Prunit - vVlrDesconto_ICMS + Vlr_Subst + xValor_PIS + xValor_Cofins + VlrIpi) * xVlrFrete;

  const VlrCustoFin =
    ((Prunit - vVlrDesconto_ICMS - VlrDesconto + VlrAcrescimo + xValor_PIS + xValor_Cofins +
      VlrIpi + Vlr_Subst + VlrFrete + vValor_MK) * CustoFin) / 100;

  const VlrCusto = round(
    Prunit - vVlrDesconto_ICMS - VlrDesconto + VlrAcrescimo + xValor_PIS + xValor_Cofins +
    VlrIpi + Vlr_Subst + VlrFrete + vValor_MK + VlrCustoFin, 2);

  const VlrCusto_Contabil = round(
    PrUnitNF - vVlrDesconto_ICMS - VlrDesconto + VlrAcrescimo + xValor_PIS + xValor_Cofins +
    VlrIpi + Vlr_Subst + VlrFrete, 2);

  const icmsdesonUnit = num(it.fis_icmsdeson) ? round(num(it.fis_icmsdeson) / Quant, 2) : 0;

  let VlrCustoZF: number;
  let VlrCustoFE: number;
  let VlrTranf_Liquido: number;
  let VlrTranf_Bruto: number;

  if (empresa.zona_isentivada === 'N') {
    // Zona NÃO incentivada
    VlrCustoZF = VlrCusto;
    VlrCustoFE = round(
      (PrUnit - VlrDesconto + VlrAcrescimo + VlrIpi + VlrFrete + vValor_MK + VlrCustoFin) +
      PrUnitNF * 0.101, 2);
    VlrTranf_Liquido = round(PrUnitNF - icmsdesonUnit, 2);
    VlrTranf_Bruto = round((VlrTranf_Liquido + vValor_MK + VlrCustoFin) + PrUnitNF * 0.05, 2);
  } else {
    // Zona incentivada (AM/RO) — as fórmulas de transferência coincidem entre RO e AM
    VlrCustoZF = round(
      (PrUnit - VlrDesconto + VlrAcrescimo + VlrIpi + VlrFrete + vValor_MK + VlrCustoFin) +
      PrUnitNF * 0.101, 2);
    VlrCustoFE = round(VlrCusto - Vlr_Subst, 2);
    VlrTranf_Liquido = round(PrUnitNF - icmsdesonUnit, 2);
    VlrTranf_Bruto = round((VlrTranf_Liquido + vValor_MK + VlrCustoFin) + PrUnitNF * 0.05, 2);
  }

  // Produto importado (Dolar='S') usa o PrTransf da própria linha
  const importado = prod.dolar === 'S';
  const VlrTranf_Liquido_Final = importado ? num(it.prtransf) : VlrTranf_Liquido;
  const VlrTranf_Bruto_Final = importado ? num(it.prtransf) : VlrTranf_Bruto;

  return {
    prcusto: VlrCusto,
    prcusto_contabil: VlrCusto_Contabil,
    prcusto_fe: VlrCustoFE,
    prcusto_zf: VlrCustoZF,
    prtransferencia_liquido: VlrTranf_Liquido_Final,
    prtransferencia_bruto: VlrTranf_Bruto_Final,
  };
}

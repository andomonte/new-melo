/**
 * Cálculo do Custo da Mercadoria — migração da aritmética final da procedure
 * Oracle TMP_PROD.PRODUTO_CALCULA_CUSTO (linhas 667-760 do package body).
 *
 * Esta é a "cola" do cálculo: recebe os COMPONENTES FISCAIS já apurados
 * (valores em R$ de IPI, ICMS-ST, PIS, COFINS e o desconto de ICMS SUFRAMA) e
 * aplica a fórmula que produz Custo / Custo FE / Custo ZF. A apuração desses
 * componentes (motor CALCULO_IMPOSTO) é a Fase 3 — quando pronta, alimenta esta
 * função e o resultado é validado ponta-a-ponta contra o Oracle.
 *
 * Referência (Oracle):
 *   vVlrCusto := vPrUnitSNF
 *   xVlrDesconto   := vPrUnitSNF * Desconto/100
 *   xVlrAcrescimo  := vPrUnitSNF * Acrescimo/100
 *   xVlrIpi        := max(valorIPI, 0)
 *   xVlr_Subst     := max(valorICMSSubst, 0)
 *   xValor_MK      := vPrUnitNF * VerbaMkt/100
 *   xVlrFrete      := (vPrUnitSNF + xVlr_Subst + PIS + COFINS + xVlrIpi) * Frete/100
 *   xVlrCustoFin   := (vPrUnitSNF - DescICMS - xVlrDesconto + xVlrAcrescimo
 *                      + PIS + COFINS + xVlrIpi + xVlr_Subst + xVlrFrete + xValor_MK) * CustoFin/100
 *   Custo          := round(vPrUnitSNF - DescICMS - xVlrDesconto + xVlrAcrescimo
 *                      + PIS + COFINS + xVlrIpi + xVlr_Subst + xVlrFrete + xValor_MK + xVlrCustoFin, 2)
 *   Zona não incentivada:
 *     CustoZF := Custo
 *     CustoFE := round((vPrUnitSNF - xVlrDesconto + xVlrAcrescimo + xVlrIpi
 *                       + xVlrFrete + xValor_MK + xVlrCustoFin) + (vPrUnitNF * 0.101), 2)
 *   Zona incentivada:
 *     xIPICusto := isentoIpi ? round(vPrUnitNF * ipiAliq/100, 2) : 0
 *     CustoZF   := round((vPrUnitSNF - xVlrDesconto + xVlrAcrescimo + xVlrIpi
 *                        + xVlrFrete + xValor_MK + xVlrCustoFin) + (vPrUnitNF * 0.101), 2)
 *     CustoFE   := round(CustoZF + xIPICusto, 2)
 */

export interface ParamsCusto {
  /** Desconto (-) % */
  desconto: number;
  /** Acréscimo (+) % */
  acrescimo: number;
  /** Custo Financeiro (+) % */
  custoFin: number;
  /** Verba de Marketing (+) % */
  verbaMkt: number;
  /** Frete (+) % */
  frete: number;
}

export interface ComponentesFiscais {
  /** xValor_IPI — valor do IPI em R$ (do motor fiscal) */
  valorIPI: number;
  /** xValor_ICMS_Subst — valor do ICMS-ST em R$ */
  valorICMSSubst: number;
  /** xValor_PIS — valor do PIS em R$ */
  valorPIS: number;
  /** xValor_Cofins — valor do COFINS em R$ */
  valorCofins: number;
  /** xVlrDesconto_ICMS — desconto de ICMS SUFRAMA em R$ (0 se não aplica) */
  descontoICMSSuframa: number;
  /** UF da empresa é zona NÃO incentivada? (xRowUFEmpresa.Zona_Isentivada = 'N') */
  zonaNaoIncentivada: boolean;
  /** Produto é isento de IPI? (dbprod.isentoipi = 'S') — só usado em zona incentivada */
  isentoIpi: boolean;
  /** Alíquota de IPI do produto (%) — só usada em zona incentivada quando isento */
  ipiAliquota: number;
}

export interface ResultadoCusto {
  custo: number;
  custoFE: number;
  custoZF: number;
}

function round2(v: number): number {
  // ROUND do Oracle (half away from zero) para 2 casas
  const f = Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  return v < 0 ? -f : f;
}

export function calcularCustoMercadoria(
  prNF: number,
  prSNF: number,
  params: ParamsCusto,
  comp: ComponentesFiscais,
): ResultadoCusto {
  const nvl = (x: number) => (Number.isFinite(x) ? x : 0);

  const descICMS = nvl(comp.descontoICMSSuframa);
  const xVlrDesconto = (prSNF * nvl(params.desconto)) / 100;
  const xVlrAcrescimo = (prSNF * nvl(params.acrescimo)) / 100;
  const xVlrIpi = comp.valorIPI > 0 ? comp.valorIPI : 0;
  const xVlrSubst = comp.valorICMSSubst > 0 ? comp.valorICMSSubst : 0;
  const xValorMK = (prNF * nvl(params.verbaMkt)) / 100;
  const pis = nvl(comp.valorPIS);
  const cofins = nvl(comp.valorCofins);

  // base do cálculo começa como vPrUnitSNF
  const base = prSNF;

  const xVlrFrete =
    ((base + xVlrSubst + pis + cofins + xVlrIpi) * nvl(params.frete)) / 100;

  const xVlrCustoFin =
    ((base -
      descICMS -
      xVlrDesconto +
      xVlrAcrescimo +
      pis +
      cofins +
      xVlrIpi +
      xVlrSubst +
      xVlrFrete +
      xValorMK) *
      nvl(params.custoFin)) /
    100;

  const custo = round2(
    base -
      descICMS -
      xVlrDesconto +
      xVlrAcrescimo +
      pis +
      cofins +
      xVlrIpi +
      xVlrSubst +
      xVlrFrete +
      xValorMK +
      xVlrCustoFin,
  );

  // parte comum das fórmulas FE/ZF
  const baseFEZF =
    prSNF -
    xVlrDesconto +
    xVlrAcrescimo +
    xVlrIpi +
    xVlrFrete +
    xValorMK +
    xVlrCustoFin +
    prNF * 0.101;

  let custoFE: number;
  let custoZF: number;

  if (comp.zonaNaoIncentivada) {
    custoZF = custo;
    custoFE = round2(baseFEZF);
  } else {
    const xIPICusto = comp.isentoIpi
      ? round2((prNF * nvl(comp.ipiAliquota)) / 100)
      : 0;
    custoZF = round2(baseFEZF);
    custoFE = round2(custoZF + xIPICusto);
  }

  return { custo, custoFE, custoZF };
}

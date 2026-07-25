/**
 * Mapeia itens da associação da NFe (web) para linhas de dbitent (modelo Delphi),
 * alimentando os insumos do motor de custo (ver custoEntrada.ts / custoMedio.ts).
 *
 * Fontes por item:
 *   - nfe_item_associacao  → produto, quantidades, preços (real/NF), meia_nota
 *   - nfe_item_pedido_associacao → codreq (ordem/pedido) — 1 linha dbitent por (produto, codreq)
 *   - dbnfe_ent_det        → imposto por item do XML (vicms, vicmsst, vipi, vpis, vcofins, vicmsdeson)
 *   - dbprod               → strib, percsubst (situação tributária p/ desconto SUFRAMA)
 *   - cad_credor_regra_faturamento → regra do fornecedor (desc_icms_sufra)
 *
 * IMPOSTO POR LINHA: os valores do det são totais da linha da NF; ao dividir uma linha
 * entre vários pedidos, cada dbitent recebe a fração (quant / qcom) — mantém o valor
 * por unidade invariante.
 *
 * DESCONTO SUFRAMA (totalicmsdesconto): benefício ZFM. Vale o vICMS do item quando a
 * regra do fornecedor permite e a situação tributária do produto se enquadra; senão 0.
 * Port do gate de ENTRADASEFAZ/CALCULO_IMPOSTO — valida ~89% dos itens históricos;
 * as exceções (regra default, petróleo/protocolo, drift histórico) ficam para refino.
 */

export interface RegraCredorFat {
  desc_icms_sufra?: number | null;
  desc_icms_sufra_importado?: number | null;
}
export interface ProdutoFiscal {
  strib?: string | null;
  percsubst?: number | null;
  isentoipi?: string | null;
  ipi?: number | null;
  dolar?: string | null;
}

const N = (v: unknown): number => (v == null ? 0 : Number(v));
const c2 = (v: number): number => Number(v.toFixed(2));

/**
 * Desconto de ICMS SUFRAMA por item. Retorna o vICMS quando o benefício se aplica, senão 0.
 * Nacional: desc_icms_sufra=1, strib[0] ∈ {0,3,4,5,8}, percsubst=0.
 * Importado: desc_icms_sufra_importado=1, strib[0] ∈ {1,2,6,7}, percsubst=0.
 * (Exceções petróleo/PROTOCOLO_1785 ainda não portadas.)
 */
export function descontoIcmsSuframa(
  regra: RegraCredorFat | null | undefined,
  prod: ProdutoFiscal,
  vIcmsItem: number
): number {
  const s = (prod.strib || '').charAt(0);
  const percsubst = N(prod.percsubst);
  if (percsubst !== 0) return 0;
  if (N(regra?.desc_icms_sufra) === 1 && ['0', '3', '4', '5', '8'].includes(s)) return vIcmsItem;
  if (N(regra?.desc_icms_sufra_importado) === 1 && ['1', '2', '6', '7'].includes(s)) return vIcmsItem;
  return 0;
}

export interface AssocItem {
  produto_cod: string;
  quantidade_associada: number;
  quantidade_nf?: number | null;
  valor_unitario?: number | null;
  preco_real?: number | null;
  preco_unitario_nf?: number | null;
  meia_nota?: boolean | null;
}
export interface DetImposto {
  qcom?: number | null;
  vicms?: number | null;
  vicmsst?: number | null;
  vipi?: number | null;
  vpis?: number | null;
  vcofins?: number | null;
  vicmsdeson?: number | null;
}
export interface PedidoAssoc {
  req_id?: string | null;
  quantidade: number;
  valor_unitario?: number | null;
}

/** Linha de insumo de dbitent (campos que o motor de custo consome). */
export interface LinhaDbitent {
  codprod: string;
  codreq: string;
  quant: number;
  quantnf: number;
  prunit: number;
  prunitnf: number;
  valor_icms: number;
  valor_ipi: number;
  valor_icms_subst: number;
  pis: number;
  cofins: number;
  totalicmsdesconto: number;
  fis_icmsdeson: number;
  prtransf: number;
}

/**
 * Monta as linhas de dbitent de UMA associação (uma por pedido; se não houver pedido,
 * uma única linha com codreq '0'). Rateia o imposto do det pela fração quant/qcom.
 */
export function montarLinhasDbitent(
  assoc: AssocItem,
  det: DetImposto | null | undefined,
  prod: ProdutoFiscal,
  regra: RegraCredorFat | null | undefined,
  pedidos: PedidoAssoc[]
): LinhaDbitent[] {
  const qcom = N(det?.qcom) || N(assoc.quantidade_associada);
  const destino: PedidoAssoc[] = pedidos.length
    ? pedidos
    : [{ req_id: '0', quantidade: N(assoc.quantidade_associada), valor_unitario: assoc.valor_unitario }];

  return destino.map((ped) => {
    const quant = N(ped.quantidade);
    const fator = qcom > 0 ? quant / qcom : 0;
    const meia = assoc.meia_nota === true;
    const prunit = meia
      ? N(assoc.preco_unitario_nf)
      : N(assoc.preco_real) || N(assoc.valor_unitario) || N(ped.valor_unitario);
    const prunitnf = N(assoc.preco_unitario_nf) || prunit;

    const vIcmsRateado = N(det?.vicms) * fator;
    const totalicmsdesconto = descontoIcmsSuframa(regra, prod, vIcmsRateado);
    // Quando o desconto SUFRAMA se aplica, o ICMS do item é zerado (como no Inc_ItEntrada)
    const valor_icms = totalicmsdesconto > 0 ? 0 : vIcmsRateado;

    return {
      codprod: assoc.produto_cod,
      codreq: ped.req_id || '0',
      quant,
      quantnf: N(assoc.quantidade_nf) || quant,
      prunit: c2(prunit),
      prunitnf: c2(prunitnf),
      valor_icms: c2(valor_icms),
      valor_ipi: c2(N(det?.vipi) * fator),
      valor_icms_subst: c2(N(det?.vicmsst) * fator),
      pis: c2(N(det?.vpis) * fator),
      cofins: c2(N(det?.vcofins) * fator),
      totalicmsdesconto: c2(totalicmsdesconto),
      fis_icmsdeson: c2(N(det?.vicmsdeson) * fator),
      prtransf: 0,
    };
  });
}

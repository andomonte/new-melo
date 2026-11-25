/**
 * Cálculo dos valores da Nota Fiscal de Serviço — usado na tela (resumo ao digitar) e no servidor.
 *   base do ISS   = serviço − desconto − deduções
 *   ISS           = base × alíquota (só entra nas retenções se RETIDO)
 *   retenções     = ISS (se retido) + PIS + COFINS + IR + INSS + CSLL + outras
 *   valor líquido = serviço − desconto − retenções  (= totalnfs = totalfat = soma dos títulos)
 */
const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;

export interface EntradaValores {
  valor_servico: number;
  valor_desconto?: number;
  valor_deducoes?: number;
  issqn_aliquota?: number;
  issqn_retido?: boolean | string;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  aliquota_ir?: number;
  aliquota_inss?: number;
  aliquota_csll?: number;
  outros_valor?: number;
}

export interface ValoresCalculados {
  valor_servico: number; valor_desconto: number; valor_deducoes: number;
  issqn_basecalculo: number; issqn_aliquota: number; issqn_retido: 'S' | 'N'; issqn_valor: number;
  pis_valor: number; cofins_valor: number; ir_valor: number; inss_valor: number; csll_valor: number;
  outros_valor: number; aliquota_pis: number; aliquota_cofins: number; aliquota_ir: number;
  aliquota_inss: number; aliquota_csll: number;
  total_retencoes: number; valor_liquido: number;
}

/** Calcula base, ISS, retenções e valor líquido (mesma conta na tela e no servidor). */
export function calcularValoresNota(e: EntradaValores): ValoresCalculados {
  const servico = r2(e.valor_servico);
  const desconto = r2(e.valor_desconto);
  const deducoes = r2(e.valor_deducoes);
  const base = r2(Math.max(0, servico - desconto - deducoes));
  const aliq = (v: any) => Math.max(0, Number(v) || 0);
  const pct = (a: number) => r2((base * a) / 100);
  const retido = e.issqn_retido === true || e.issqn_retido === 'S';
  const issAliq = aliq(e.issqn_aliquota);
  const iss = pct(issAliq);
  const pis = pct(aliq(e.aliquota_pis));
  const cofins = pct(aliq(e.aliquota_cofins));
  const ir = pct(aliq(e.aliquota_ir));
  const inss = pct(aliq(e.aliquota_inss));
  const csll = pct(aliq(e.aliquota_csll));
  const outros = r2(e.outros_valor);
  const retencoes = r2((retido ? iss : 0) + pis + cofins + ir + inss + csll + outros);
  return {
    valor_servico: servico, valor_desconto: desconto, valor_deducoes: deducoes,
    issqn_basecalculo: base, issqn_aliquota: issAliq, issqn_retido: retido ? 'S' : 'N', issqn_valor: iss,
    pis_valor: pis, cofins_valor: cofins, ir_valor: ir, inss_valor: inss, csll_valor: csll, outros_valor: outros,
    aliquota_pis: aliq(e.aliquota_pis), aliquota_cofins: aliq(e.aliquota_cofins), aliquota_ir: aliq(e.aliquota_ir),
    aliquota_inss: aliq(e.aliquota_inss), aliquota_csll: aliq(e.aliquota_csll),
    total_retencoes: retencoes,
    valor_liquido: r2(servico - desconto - retencoes),
  };
}


/** CALCULAR_PARCELAS_NFS (Delphi): parcelas iguais; a 1ª leva a diferença do arredondamento. */
export function dividirParcelas(total: number, qtd: number): number[] {
  const t = r2(total);
  if (qtd <= 1) return [t];
  const p = r2(t / qtd);
  return [r2(p + (t - p * qtd)), ...Array(qtd - 1).fill(p)];
}

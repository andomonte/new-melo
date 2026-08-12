// src/lib/faturamento/calcularTotaisFatura.ts
//
// Porte do FATURAMENTOS.CALCULAR_TOTAIS (Oracle, package body linhas 2060-2458).
// Calcula os totais do "Espelho dos valores da fatura" a partir dos itens + parâmetros
// da fatura (frete/desconto/acréscimo), replicando o rateio de frete na base de ICMS.
//
// Escopo do preview: NÃO persiste (o Delphi faz UPDATE em dbprodfat/dbfatura). Aqui só
// agrega para exibição. O rateio de ST no frete (ICMS_ST_FRETE) só ocorre p/ MELO em
// PB/PE — MELO é AM, então não se aplica (deixado como TODO explícito).

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
// Valores de item/fatura chegam como número OU string decimal com PONTO (padrão do
// Postgres para numeric: "119.25"). Number() já converte certo — NÃO usar parser pt-BR
// aqui (removeria o ponto e multiplicaria por 100). Percentuais digitados (com vírgula)
// são normalizados no chamador antes de entrar aqui.
const num = (v: any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type ItemFatura = {
  qtd?: any; qtde?: any; prunit?: any;
  totalproduto?: any;      // já com desconto de ICMS Suframa aplicado (por item)
  totalipi?: any;
  baseicms?: any; totalicms?: any;
  aliquota_icms?: any; icms?: any; // aliquota % (preferir aliquota_icms)
  basesubst_trib?: any; totalsubst_trib?: any;
  totalicmsdesconto?: any;
};

export type ParamsFatura = {
  descontoPerc?: number;   // fatura.Desconto (%)
  acrescimoPerc?: number;  // fatura.Acrescimo (%)
  totalfrete?: number;     // fatura.Totalfrete (valor)
  freteNf?: boolean;       // Frete_Nf = 'S' (compõe a NF)
  descontoNf?: boolean;    // Desconto_NF = 'S'
  acrescimoNf?: boolean;   // Acrescimo_NF = 'S'
  valorII?: number;        // importação (normalmente 0)
};

export type EspelhoTotais = {
  baseIcms: number; valorIcms: number;
  baseSt: number; valorSt: number;
  totalProd: number;        // TOTALPROD (bruto: Σ qtd×prunit)
  totalProdSuframa: number; // TOTALPRODSUFRAMA (líquido do desconto ICMS Suframa)
  totalIcmsDesc: number;    // TOTALICMSDESCONTO (valor do ICMS descontado)
  totalIpi: number;
  totalFrete: number;       // frete que compõe a NF
  valorDesconto: number;    // Σtotalproduto × desconto%
  despesa: number;          // = acréscimo que compõe a NF
  totalFat: number;
  totalNf: number;
};

export function calcularTotaisFatura(itensRaw: ItemFatura[], p: ParamsFatura = {}): EspelhoTotais {
  const itens = itensRaw ?? [];
  const count = itens.length;
  const totalfrete = num(p.totalfrete);
  const valorII = num(p.valorII);

  // ---- pré-loop (FATURAMENTOS 2093-2131) ----
  const somaTotalProduto = itens.reduce((s, it) => s + num(it.totalproduto), 0);
  const vlrDesconto = r2(somaTotalProduto * (num(p.descontoPerc) / 100));
  const vlrAcrescimo = r2(somaTotalProduto * (num(p.acrescimoPerc) / 100));
  const totalfreteNF = p.freteNf ? totalfrete : 0;
  const descontoNF = p.descontoNf ? vlrDesconto : 0;
  const acrescimoNF = p.acrescimoNf ? vlrAcrescimo : 0;
  const despesa = p.acrescimoNf ? vlrAcrescimo : 0;

  let totalprod = 0, totalipi = 0, baseSt = 0, valorSt = 0;
  let totalProdSuframa = 0, totalDescSuframa = 0;
  let baseIcms = 0, valorIcms = 0;

  // ---- loop dos itens (2133-2418) ----
  itens.forEach((it, idx) => {
    const i = idx + 1;
    const qtd = num(it.qtd ?? it.qtde);
    const prunit = num(it.prunit);
    totalprod += qtd * prunit;
    totalipi += num(it.totalipi);
    baseSt += num(it.basesubst_trib);
    valorSt += num(it.totalsubst_trib);
    totalProdSuframa += num(it.totalproduto);
    totalDescSuframa += num(it.totalicmsdesconto);

    // rateio do frete na base de ICMS (só itens com ICMS > 0) — 2145-2205
    let itBase = num(it.baseicms);
    let itTotal = num(it.totalicms);
    const aliq = num(it.aliquota_icms ?? it.icms);
    if (aliq > 0 && totalfrete > 0) {
      let freteParcela: number;
      if (count === 1) freteParcela = r2(totalfrete);
      else if (i === 1) freteParcela = totalfrete - r2(totalfrete / count) * (count - 1); // remainder no 1º
      else freteParcela = r2(totalfrete / count);
      itBase = itBase + freteParcela;
      itTotal = r2(itBase * aliq / 100);
    }
    baseIcms += itBase;
    valorIcms += itTotal;
    // OBS: rateio de ST no frete (ICMS_ST_FRETE) é só p/ MELO em PB/PE — não se aplica em AM.
  });

  // ---- totais finais (2420-2425) ----
  const totalFat = r2(totalProdSuframa + totalipi + valorSt + totalfreteNF + vlrAcrescimo - vlrDesconto + valorII);
  const totalNf = r2(totalProdSuframa + totalipi + valorSt + totalfreteNF + acrescimoNF - descontoNF + valorII);

  return {
    baseIcms: r2(baseIcms),
    valorIcms: r2(valorIcms),
    baseSt: r2(baseSt),
    valorSt: r2(valorSt),
    totalProd: r2(totalprod),
    totalProdSuframa: r2(totalProdSuframa),
    totalIcmsDesc: r2(totalDescSuframa),
    totalIpi: r2(totalipi),
    totalFrete: r2(totalfreteNF),
    valorDesconto: vlrDesconto,
    despesa: r2(despesa),
    totalFat,
    totalNf,
  };
}

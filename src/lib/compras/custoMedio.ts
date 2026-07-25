/**
 * Média ponderada de custo por produto — porte fiel de ENTRADASEFAZ.CALCULAR_MEDIO (Oracle/Delphi).
 *
 * Função PURA: recebe o estado atual do produto (dbprod / dbprod_custo / dbprod_contabil) e os
 * custos por unidade do item (saída de calcularCustoItem) e devolve os novos valores a gravar.
 * A persistência (UPDATE nas 3 tabelas) e o recálculo de preço de venda
 * (POLITICA_PRECO_VENDA.ATUALIZAR_PRECO_MARGEM) ficam a cargo do chamador.
 *
 * ORDENAÇÃO CRÍTICA: o peso do custo antigo é o estoque ATUAL (qtest - qtdreservada).
 * Portanto CALCULAR_MEDIO deve rodar ANTES de a entrada somar a quantidade ao estoque,
 * senão a quantidade nova é contada duas vezes.
 *
 * Validado contra a procedure VIVA do Oracle: 366 produtos distintos, 9 campos de saída,
 * 100% idênticos, cobrindo o caminho de média ponderada e o de passthrough.
 */
import { round } from './custoEntrada';

const N = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Média ponderada com gate fixo (Prcompra>0 e estoqueDisp>0), exatamente como no Oracle. */
function mediaPond(gateCusto: number, gateQtd: number, novoCusto: number, quant: number, custoAntUsado: number): number {
  if (gateCusto > 0 && gateQtd > 0) {
    const m = (novoCusto * quant + custoAntUsado * gateQtd) / (quant + gateQtd);
    return m <= 0 ? novoCusto : m;
  }
  return novoCusto;
}

export interface ProdutoEstado {
  prcompra?: number | null;
  qtest?: number | null;
  qtdreservada?: number | null;
  prcompraf?: number | null;
  prcomprasemst?: number | null;
}
export interface ProdutoCustoEstado {
  prcusto_zf?: number | null;
  prtransferencia_bruto?: number | null;
}
export interface ProdutoContabilEstado {
  prcusto?: number | null;
  estoque?: number | null;
}
export interface CustosItemMedia {
  prcusto: number;
  prcusto_zf: number;
  prcusto_fe: number;
  prtransferencia_liquido: number;
  prtransferencia_bruto: number;
  prcusto_contabil: number;
}
export interface NovosCustosProduto {
  dbprod: { prcompra: number; prcomprasemst: number; prcompraf: number; qtdcompra: number };
  dbprod_custo: {
    prcusto: number;
    prtransferencia_liquido: number;
    prtransferencia_bruto: number;
    prcusto_zf: number;
    prcusto_fe: number;
  };
  dbprod_contabil: { prcusto: number };
}

/**
 * Calcula os novos custos médios do produto após a entrada de `quant` unidades.
 * NÃO grava nada — devolve os valores para o chamador persistir.
 */
export function calcularMedia(
  prod: ProdutoEstado,
  custo: ProdutoCustoEstado,
  contabil: ProdutoContabilEstado,
  item: CustosItemMedia,
  quant: number
): NovosCustosProduto {
  const Prcompra = N(prod.prcompra);
  const estDisp = N(prod.qtest) - N(prod.qtdreservada);

  const custoMedio = mediaPond(Prcompra, estDisp, N(item.prcusto), quant, Prcompra);
  const zfMedio = mediaPond(Prcompra, estDisp, N(item.prcusto_zf), quant, N(custo.prcusto_zf));
  const feMedio = mediaPond(Prcompra, estDisp, N(item.prcusto_fe), quant, N(prod.prcompraf));
  const tranfLiqMedio = mediaPond(Prcompra, estDisp, N(item.prtransferencia_liquido), quant, N(prod.prcomprasemst));
  const tranfBruMedio = mediaPond(Prcompra, estDisp, N(item.prtransferencia_bruto), quant, N(custo.prtransferencia_bruto));

  // Contábil: gate próprio (prcusto contábil>0 e estoque contábil>0), estoque floored em 0
  const estContabil = N(contabil.estoque) < 0 ? 0 : N(contabil.estoque);
  const prcContAnt = N(contabil.prcusto);
  let contabilMedio: number;
  if (prcContAnt > 0 && estContabil > 0) {
    const m = (N(item.prcusto_contabil) * quant + prcContAnt * estContabil) / (quant + estContabil);
    contabilMedio = m <= 0 ? N(item.prcusto_contabil) : m;
  } else {
    contabilMedio = N(item.prcusto_contabil);
  }

  return {
    dbprod: {
      prcompra: round(custoMedio, 2),
      prcomprasemst: round(tranfLiqMedio, 2),
      prcompraf: round(feMedio, 2),
      qtdcompra: quant,
    },
    dbprod_custo: {
      prcusto: round(custoMedio, 2),
      prtransferencia_liquido: round(tranfLiqMedio, 2),
      prtransferencia_bruto: round(tranfBruMedio, 2),
      prcusto_zf: round(zfMedio, 2),
      prcusto_fe: round(feMedio, 2),
    },
    dbprod_contabil: {
      prcusto: contabilMedio, // NÃO arredondado no Oracle
    },
  };
}

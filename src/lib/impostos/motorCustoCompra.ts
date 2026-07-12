/**
 * Motor de custo de COMPRA — migração da fatia de ENTRADA_COMPRAS do pacote
 * Oracle CALCULO_IMPOSTO usada pela PRODUTO_CALCULA_CUSTO. Produz os componentes
 * fiscais (IPI, ICMS-ST, PIS, COFINS, desconto ICMS SUFRAMA) que alimentam a
 * aritmética já migrada e validada em `calcularCustoMercadoria.ts`.
 *
 * Cada peça é portada e validada contra o Oracle (harness em scratchpad,
 * instrumentando a própria procedure para expor os valores internos).
 *
 * Estado da migração:
 *   [x] IPI (Validar_IPI compra + valor)   — 20/20 OK vs Oracle
 *   [ ] PIS/COFINS de compra
 *   [ ] ICMS-ST (MVA + regra credor + SUFRAMA)
 */

function round2(v: number): number {
  const f = Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  return v < 0 ? -f : f;
}

export interface EstadoProdutoCompra {
  /** dbprod.isentoipi (S/C/P/Z/I/T) — situação do IPI */
  isentoipi: string;
  /** dbprod.strib — situação tributária (3 díg.; 1º díg. indica origem/importado) */
  strib: string;
  /** dbprod.ipi — alíquota de IPI do produto (%) */
  ipiAliquota: number;
  /** Zona_Isentivada da UF de destino (empresa) — 'S' incentivada / 'N' não */
  zonaDestino: string;
  /** cad_credor_regra_faturamento.cobrar_ipi_importado (0/1/NULL) do fornecedor */
  cobrarIpiImportado: number | null;
}

/**
 * IPI de ENTRADA_COMPRAS (TipoOperacao COMPRA). Espelha CALCULO_IMPOSTO.Validar_IPI
 * (ramo ENTRADA_COMPRAS) + o valor calculado em Calcular_Impostos
 * (Valor_IPI := round(Base * Aliquota/100, 2)).
 *
 * IMPORTANTE (paridade Oracle): `cobrar_ipi_importado = 0` com valor NULL é
 * FALSO no Oracle (NULL = 0 → desconhecido). Por isso a comparação é estrita
 * (=== 0), sem coagir NULL para 0.
 *
 * @param base  base do IPI (Base_Produto / xTotalProd)
 */
export function calcularIPICompra(
  estado: EstadoProdutoCompra,
  base: number,
): { aliquota: number; valor: number } {
  const primeiroDigStrib = String(estado.strib || '').charAt(0);

  // Validar_IPI (compra): quando o IPI é cobrado/pago
  const cobra =
    estado.isentoipi === 'C' ||
    estado.isentoipi === 'P' ||
    (estado.isentoipi === 'S' && estado.zonaDestino === 'N');

  let aliquota: number;
  if (cobra) {
    if (
      ['1', '2', '3'].includes(primeiroDigStrib) &&
      estado.cobrarIpiImportado === 0
    ) {
      aliquota = 0;
    } else {
      aliquota = Number(estado.ipiAliquota) || 0;
    }
  } else {
    aliquota = 0;
  }

  // valor = round(base * aliq/100, 2)
  const valor = round2(((Number(base) || 0) * aliquota) / 100);

  return { aliquota, valor };
}

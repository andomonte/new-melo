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
 *   [x] PIS/COFINS de compra                — 66/66 OK vs Oracle
 *   [ ] ICMS-ST (MVA + regra credor + SUFRAMA)
 */

function round2(v: number): number {
  const f = Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  return v < 0 ? -f : f;
}

const nvl = <T>(x: T | null | undefined, d: T): T => (x == null ? d : x);
/** compara totais com tolerância — Oracle usa NUMBER decimal exato, JS tem FP */
const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;

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

export interface EstadoPisCofinsCompra {
  /** DadosOrigem.RegimeTributario do fornecedor: '0' Simples, '1' Presumido, '2' Real */
  regimeFornecedor: string;
  /** DadosOrigem.Fabricante ('S'/'N') */
  fabricante: string;
  /** RowUF_Origem.Uf — UF do fornecedor */
  ufOrigem: string;
  /** RowUF_Destino.Uf — UF da empresa (AM) */
  ufDestino: string;
  /** RowRegraCredor.Piscofins_365/_925/_1150/_1310 (0/1/2/3/4/NULL) */
  piscofins365: number | null;
  piscofins925: number | null;
  piscofins1150: number | null;
  piscofins1310: number | null;
  /** RowProd.pis, RowProd.cofins (alíquotas do produto) */
  prodPis: number;
  prodCofins: number | null;
}

export interface ResultadoPisCofins {
  valorPis: number;
  valorCofins: number;
  aliquotaPis: number;
  aliquotaCofins: number;
}

/**
 * PIS/COFINS de ENTRADA_COMPRAS (TipoOperacao COMPRA). Espelha
 * CALCULO_IMPOSTO.Calcular_PIS_COFINS_Compra. Valores podem ser NEGATIVOS
 * (crédito/desconto) — no custo eles reduzem o total.
 *
 * @param base Base_Produto (xBaseAlterada) sobre a qual incide.
 */
export function calcularPisCofinsCompra(
  st: EstadoPisCofinsCompra,
  base: number,
): ResultadoPisCofins {
  let valorPis = 0;
  let valorCofins = 0;
  let aliquotaPis = 0;
  let aliquotaCofins = 0;

  const total0 = nvl(st.prodPis, 0) + nvl(st.prodCofins, 0); // ramo 9.25
  const total2 = nvl(st.prodPis, 0) + nvl(st.prodCofins, 2); // ramos 11.50/13.10 (nvl 2, como no Oracle)

  if (st.regimeFornecedor === '0') {
    // Simples Nacional — sem crédito (CST 73)
  } else if (
    st.regimeFornecedor === '1' &&
    st.ufOrigem !== 'AM' &&
    st.ufDestino === 'AM'
  ) {
    // Lucro Presumido
    if (nvl(st.piscofins365, 1) === 1) {
      valorPis = round2(base * 0.0065) * -1;
      valorCofins = round2(base * 0.03) * -1;
      aliquotaPis = 0.65;
      aliquotaCofins = 3.0;
    }
  } else if (st.regimeFornecedor === '2') {
    // Lucro Real
    if (
      eq(total0, 9.25) &&
      st.ufOrigem !== 'AM' &&
      st.ufDestino === 'AM' &&
      st.fabricante === 'S'
    ) {
      if (nvl(st.piscofins925, 1) === 1) {
        valorPis = round2(base * 0.0165) * -1;
        valorCofins = round2(base * 0.076) * -1;
        aliquotaPis = 1.65;
        aliquotaCofins = 7.6;
      }
    } else if (eq(total2, 11.5) && st.ufDestino === 'AM' && st.fabricante === 'S') {
      const r = nvl(st.piscofins1150, 0);
      if (r === 1) {
        valorPis = round2(base * 0.02);
        valorCofins = round2(base * 0.095);
        aliquotaPis = 2.0;
        aliquotaCofins = 9.5;
      } else if (r === 2) {
        valorPis = round2(base * 0.02) * -1;
        valorCofins = round2(base * 0.095) * -1;
        aliquotaPis = 2.0;
        aliquotaCofins = 9.5;
      } else if (r === 3) {
        valorPis = round2(base * 0.02 * 0.885);
        valorCofins = round2(base * 0.095 * 0.885);
        aliquotaPis = 2.0;
        aliquotaCofins = 9.5;
      }
    } else if (eq(total2, 13.1) && st.ufDestino === 'AM' && st.fabricante === 'S') {
      const r = nvl(st.piscofins1310, 0);
      if (r === 1) {
        valorPis = round2(base * 0.023);
        valorCofins = round2(base * 0.108);
        aliquotaPis = 2.3;
        aliquotaCofins = 10.8;
      } else if (r === 2) {
        valorPis = round2(base * 0.023) * -1;
        valorCofins = round2(base * 0.108) * -1;
        aliquotaPis = 2.3;
        aliquotaCofins = 10.8;
      } else if (r === 3) {
        valorPis = round2(base * 0.023 * 0.869);
        valorCofins = round2(base * 0.108 * 0.869);
        aliquotaPis = 2.3;
        aliquotaCofins = 10.8;
      } else if (r === 4) {
        valorPis = round2(base * 0.0165) * -1;
        valorCofins = round2(base * 0.076) * -1;
        aliquotaPis = 1.65;
        aliquotaCofins = 7.6;
      }
    }
  }

  return { valorPis, valorCofins, aliquotaPis, aliquotaCofins };
}

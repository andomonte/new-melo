/**
 * Motor de custo de COMPRA — migração da fatia de ENTRADA_COMPRAS do pacote
 * Oracle CALCULO_IMPOSTO usada pela PRODUTO_CALCULA_CUSTO. Produz os componentes
 * fiscais (IPI, ICMS-ST, PIS, COFINS, desconto ICMS SUFRAMA) que alimentam a
 * aritmética já migrada e validada em `calcularCustoMercadoria.ts`.
 *
 * MOTOR COMPLETO validado ponta-a-ponta: 110/110 Custo/FE/ZF identicos ao Oracle.
 * Cada peça é portada e validada contra o Oracle (harness em scratchpad,
 * instrumentando a própria procedure para expor os valores internos).
 *
 * Estado da migração:
 *   [x] IPI (Validar_IPI compra + valor)   — 20/20 OK vs Oracle
 *   [x] PIS/COFINS de compra                — 66/66 OK vs Oracle
 *   [x] Validar_ICMS (alíquota ICMS compra) — 48/48 OK vs Oracle
 *   [x] Desconto SUFRAMA (xVlrDesconto_ICMS) — 72/72 OK vs Oracle
 *   [~] ICMS-ST: valor 48/48 OK; MVA ajustada/derivado OK; MVA_PRODUTO_LEGISLACAO 80/80 OK
 */

import { calcularCustoMercadoria, type ParamsCusto, type ResultadoCusto } from './calcularCustoMercadoria';

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

export interface EstadoValidarICMS {
  /** CFOP apurado */
  cfop: string;
  /** RowUF_Origem.Uf (fornecedor na compra) */
  ufOrigem: string;
  /** RowUF_Destino.Uf (empresa, AM) */
  ufDestino: string;
  /** dbprod.strib — 1º díg. em (1,2,3,8) => produto importado */
  strib: string;
  /** RowUF_Origem.Icmsinterno */
  icmsInterno: number;
  /** RowUF_Origem.Icmsexterno */
  icmsExterno: number;
  /** RowNCM.Agregado (= dbprod.percsubst) */
  agregado: number;
  /** LEGISLACAO_ICMS: NCM participa de CONVENIO/PROTOCOLO/RESOLUCAO/DECRETO vigente */
  legislacao: boolean;
}

/**
 * Alíquota de ICMS para ENTRADA_COMPRAS (Insc_Estadual '04', empresa AM).
 * Espelha CALCULO_IMPOSTO.Validar_ICMS (ramos aplicáveis à compra; os ramos
 * de Insc '07' e UF 'RO' não se aplicam aqui). Validado 48/48 vs Oracle.
 */
export function validarICMSCompra(st: EstadoValidarICMS): number {
  const importado = ['1', '2', '3', '8'].includes(String(st.strib || '').charAt(0));
  const externoOuImp = importado ? 4.0 : Number(st.icmsExterno) || 0;
  const ufIguais = st.ufOrigem === st.ufDestino;
  const cfop = String(st.cfop || '');

  if (cfop === '1600') return 6.0;
  if (['6915', '6916'].includes(cfop)) return 0.0;
  if (['5551', '6651', '1553'].includes(cfop)) {
    return ufIguais ? Number(st.icmsInterno) || 0 : externoOuImp;
  }
  // legislação (convênio/protocolo/resolução/decreto) OU MVA agregado > 0
  if (st.legislacao || (Number(st.agregado) || 0) > 0) {
    return ufIguais ? 0.0 : externoOuImp;
  }
  return ufIguais ? Number(st.icmsInterno) || 0 : externoOuImp;
}

/** Derivado_Petroleo: NCM começa com 2710193 (CALCULO_IMPOSTO.Derivado_Petroleo). */
export function ncmDerivadoPetroleo(ncm: string): boolean {
  return String(ncm || '').replace(/\D/g, '').substr(0, 7) === '2710193';
}

export interface EstadoDescontoSuframa {
  /** RowRegraCredor.desc_icms_sufra (1 = aplica p/ nacional) */
  descIcmsSufra: number | null;
  /** RowRegraCredor.desc_icms_sufra_importado (1 = aplica p/ importado) */
  descIcmsSufraImportado: number | null;
  /** dbprod.percsubst — só aplica quando 0 */
  percsubst: number;
  /** dbprod.strib — 1º díg. '0' nacional / '1','2' importado */
  strib: string;
  /** dbprod.clasfiscal (NCM) — para Derivado_Petroleo */
  ncm: string;
  /** PROTOCOLO_1785 (NCM em protocolo nº 17) — bloqueia o desconto */
  protocolo1785: boolean;
  /** Validar_ICMS('04', cfop) já apurado (%) — ver validarICMSCompra */
  aliquotaICMS: number;
}

/**
 * Desconto de ICMS SUFRAMA (xVlrDesconto_ICMS do TMP_PROD.PRODUTO_CALCULA_CUSTO).
 * Aplica quando a regra do credor concede o desconto, o produto não tem ST
 * (percsubst=0), não é derivado de petróleo nem está no protocolo 1785.
 * Validado 72/72 vs Oracle.
 *
 * @param prNF vPrUnitNF (preço com nota)
 */
export function calcularDescontoSuframa(
  st: EstadoDescontoSuframa,
  prNF: number,
): number {
  const primeiroDig = String(st.strib || '').charAt(0);
  const semST = (Number(st.percsubst) || 0) === 0;
  const derivado = ncmDerivadoPetroleo(st.ncm);

  const cond1 =
    st.descIcmsSufra === 1 &&
    semST &&
    primeiroDig === '0' &&
    !derivado &&
    !st.protocolo1785;
  const cond2 =
    st.descIcmsSufraImportado === 1 &&
    semST &&
    ['1', '2'].includes(primeiroDig) &&
    !derivado &&
    !st.protocolo1785;

  if (cond1 || cond2) {
    return round2((Number(prNF) || 0) * (Number(st.aliquotaICMS) || 0) / 100);
  }
  return 0;
}

function round4(v: number): number {
  const f = Math.round((Math.abs(v) + Number.EPSILON) * 10000) / 10000;
  return v < 0 ? -f : f;
}

/**
 * MVA ajustada (Calcular_ICMS_Subst, caso Agregado>0 e UF origem≠destino, não RO):
 *   ((1 + agregado/100) · (1 − externo/100) / (1 − interno/100)) − 1
 * (mesma fórmula da function calcular_mva_ajustado do Postgres).
 */
export function calcularMvaAjustado(
  agregado: number,
  icmsExterno: number,
  icmsInterno: number,
): number {
  return round4(
    (1 + agregado / 100) * (1 - icmsExterno / 100) / (1 - icmsInterno / 100) - 1,
  );
}

/** MVA de derivado de petróleo (CALCULO_IMPOSTO.MVA_Derivado_Petroleo). */
export function mvaDerivadoPetroleo(
  ufOrigem: string,
  ufDestino: string,
  tipoMovimentacao: string,
): number {
  if (ufDestino === ufOrigem && tipoMovimentacao !== 'SAIDA') return 61.31 / 100;
  if (ufDestino !== ufOrigem && ufDestino === 'AC') return 94.35 / 100;
  if (ufDestino !== ufOrigem) return 96.72 / 100;
  return 0;
}

export interface EstadoValorICMSSubst {
  /** ICMS_Interno_Destino (%) — RowUF_Destino.Icmsinterno (empresa AM) */
  icmsInterno: number;
  /** ICMS_Externo_Origem (%) — importado?4:RowUF_Origem.Icmsexterno */
  icmsExterno: number;
  /** Base_Produto (vPrUnitNF) */
  precoNF: number;
  /** RowRegraCredor.BaseReduzida_ST = 1 (só ENTRADA_COMPRAS) */
  baseReduzidaST: boolean;
  /** Valor_ICMS já apurado (usado no caso BaseReduzida_ST) */
  valorICMS: number;
  /** Derivado de petróleo */
  derivado: boolean;
}

/**
 * Valor do ICMS-ST (Calcular_ICMS_Subst) dado a Base_Calc_ICMS_Subst já apurada
 * (= round((Total_Produto + Valor_IPI) · (1 + MVA), 2)). Cobre os casos de
 * ENTRADA_COMPRAS (destino = empresa AM; MT/MS e destino final não se aplicam).
 * Validado 48/48 vs Oracle (produtos com ST reais).
 *
 * NOTA: a MVA desses produtos vem de MVA_PRODUTO_LEGISLACAO (parser de protocolo),
 * ainda a portar; aqui a base já embute a MVA correta.
 */
export function calcularValorICMSSubst(
  base: number,
  st: EstadoValorICMSSubst,
): number {
  const interno = Number(st.icmsInterno) || 0;
  if (st.derivado) return round2(base * (interno / 100));
  if (st.baseReduzidaST) return round2(base * (interno / 100) - (Number(st.valorICMS) || 0));
  return round2(base * (interno / 100) - (Number(st.precoNF) || 0) * ((Number(st.icmsExterno) || 0) / 100));
}

/**
 * MVA de produto por legislação (CALCULO_IMPOSTO.MVA_PRODUTO_LEGISLACAO).
 * Só existem 2 fórmulas em LEI_Mva_Ajustada (confirmado no banco):
 *   - 3 binds: ((1 + mvaOrig/100)·(1 − externo/100)/(1 − interno/100)) − 1  (= MVA ajustada)
 *   - 1 bind:  mvaOrig/100
 * Fornecedor Simples (regime 0) em ENTRADA_COMPRAS usa sempre mvaOrig/100.
 * Validado 80/80 vs Oracle.
 *
 * @param mvaOrig LIN_Mva_St_Original do protocolo (CAD_LEGISLACAO_ICMSST_ncm)
 * @param colons  nº de ':' em LEI_Mva_Ajustada (3 ou 1)
 */
export function mvaProdutoLegislacao(
  mvaOrig: number,
  colons: number,
  icmsExterno: number,
  icmsInterno: number,
  regimeFornecedor: string,
  tipoMovimentacao: string,
): number {
  if (tipoMovimentacao === 'ENTRADA_COMPRAS' && String(regimeFornecedor) === '0') {
    return round4(mvaOrig / 100);
  }
  if (colons === 3) return calcularMvaAjustado(mvaOrig, icmsExterno, icmsInterno);
  if (colons === 1) return round4(mvaOrig / 100);
  return 0;
}

/**
 * ORQUESTRAÇÃO do custo de compra — junta as peças validadas na mesma ordem do
 * CALCULO_IMPOSTO.Calcular_Impostos (ramo ENTRADA_COMPRAS/COMPRA), já com as
 * simplificações confirmadas no fonte:
 *   - Aliquota_ICMS passada = 0  ⇒  Valor_ICMS = 0 (não afeta as bases);
 *   - Tipo_Operacao_Entrada('COMPRA')  ⇒  Pode_ST = True sempre;
 *   - Base do IPI e do PIS/COFINS = vPrUnitNF (Base_Produto).
 *
 * Total_Produto (xTotalProd) recebe o desconto de ICMS SUFRAMA na base quando a
 * regra concede (mesma condição do desconto SUFRAMA).
 *
 * Falta apenas alimentar `mva` e `legislacao` a partir das tabelas de protocolo
 * (LEGISLACAO_ICMS/MVA_PRODUTO_LEGISLACAO) na camada de integração (Postgres).
 */
export interface EstadoCompraCompleto {
  prNF: number;
  prSNF: number;
  params: ParamsCusto;
  // produto
  isentoipi: string;
  strib: string;
  ipiAliquota: number;
  percsubst: number;
  ncm: string;
  prodPis: number;
  prodCofins: number | null;
  // empresa (destino) / fornecedor (origem)
  ufEmpresa: string;
  zonaEmpresa: string; // Zona_Isentivada
  icmsInternoEmpresa: number;
  ufFornecedor: string;
  icmsExternoFornecedor: number;
  regimeFornecedor: string;
  fabricante: string;
  // regra do credor
  cobrarIpiImportado: number | null;
  piscofins365: number | null;
  piscofins925: number | null;
  piscofins1150: number | null;
  piscofins1310: number | null;
  descIcmsSufra: number | null;
  descIcmsSufraImportado: number | null;
  baseReduzidaST: number | null;
  descPiscofinsST: number | null;
  acresPiscofinsST: number | null;
  // fiscal já apurado na integração
  cfop: string;
  legislacao: boolean;
  protocolo1785: boolean;
  mva: number; // 0 se não há ST; senão MVA final (ajustada/derivado/legislação)
  zerarST: boolean;
}

export function orquestrarCustoCompra(e: EstadoCompraCompleto): ResultadoCusto {
  const importado = ['1', '2', '3'].includes(String(e.strib).charAt(0));

  // IPI (base = vPrUnitNF)
  const ipi = calcularIPICompra(
    { isentoipi: e.isentoipi, strib: e.strib, ipiAliquota: e.ipiAliquota, zonaDestino: e.zonaEmpresa, cobrarIpiImportado: e.cobrarIpiImportado },
    e.prNF,
  );

  // Alíquota de ICMS (para SUFRAMA e base)
  const aliqICMS = validarICMSCompra({
    cfop: e.cfop, ufOrigem: e.ufFornecedor, ufDestino: e.ufEmpresa, strib: e.strib,
    icmsInterno: e.icmsInternoEmpresa, icmsExterno: e.icmsExternoFornecedor,
    agregado: e.percsubst, legislacao: e.legislacao,
  });

  // Total_Produto (xTotalProd) com desconto SUFRAMA na base, quando aplica
  const s1 = String(e.strib).charAt(0);
  const semST = (Number(e.percsubst) || 0) === 0;
  const derivado = ncmDerivadoPetroleo(e.ncm);
  const aplicaSufraBase =
    (!derivado && !e.protocolo1785 && semST) &&
    ((e.descIcmsSufra === 1 && s1 === '0') ||
      (e.descIcmsSufraImportado === 1 && ['1', '2'].includes(s1)));
  const totalProduto = aplicaSufraBase
    ? round2((e.prNF * (100 - aliqICMS)) / 100)
    : e.prNF;

  // PIS/COFINS (base = vPrUnitNF)
  const pc = calcularPisCofinsCompra(
    {
      regimeFornecedor: e.regimeFornecedor, fabricante: e.fabricante,
      ufOrigem: e.ufFornecedor, ufDestino: e.ufEmpresa,
      piscofins365: e.piscofins365, piscofins925: e.piscofins925,
      piscofins1150: e.piscofins1150, piscofins1310: e.piscofins1310,
      prodPis: e.prodPis, prodCofins: e.prodCofins,
    },
    e.prNF,
  );

  // Desconto SUFRAMA (valor)
  const descontoSuframa = calcularDescontoSuframa(
    {
      descIcmsSufra: e.descIcmsSufra, descIcmsSufraImportado: e.descIcmsSufraImportado,
      percsubst: e.percsubst, strib: e.strib, ncm: e.ncm,
      protocolo1785: e.protocolo1785, aliquotaICMS: aliqICMS,
    },
    e.prNF,
  );

  // ICMS-ST (Pode_ST sempre true p/ COMPRA; ST=0 quando MVA<=0)
  let valorICMSSubst = 0;
  if (!e.zerarST && e.mva > 0) {
    // xBaseAlterada do ST (Valor_ICMS = 0, então o termo Desc_Icms_Sufra_St some)
    let xBaseAlterada = e.baseReduzidaST === 1 ? totalProduto : e.prNF;
    if (e.descPiscofinsST === 1 && pc.valorCofins < 0) {
      xBaseAlterada += pc.valorPis + pc.valorCofins;
    }
    if (e.acresPiscofinsST === 1 && pc.valorCofins > 0) {
      xBaseAlterada += pc.valorPis + pc.valorCofins;
    }
    const baseCalcST = round2((xBaseAlterada + ipi.valor) * (1 + e.mva));
    valorICMSSubst = calcularValorICMSSubst(baseCalcST, {
      icmsInterno: e.icmsInternoEmpresa,
      icmsExterno: importado ? 4.0 : e.icmsExternoFornecedor,
      precoNF: e.prNF,
      baseReduzidaST: e.baseReduzidaST === 1,
      valorICMS: 0,
      derivado,
    });
  }

  // Aritmética final
  return calcularCustoMercadoria(e.prNF, e.prSNF, e.params, {
    valorIPI: ipi.valor,
    valorICMSSubst,
    valorPIS: pc.valorPis,
    valorCofins: pc.valorCofins,
    descontoICMSSuframa: descontoSuframa,
    zonaNaoIncentivada: e.zonaEmpresa === 'N',
    isentoIpi: e.isentoipi === 'S',
    ipiAliquota: e.ipiAliquota,
  });
}

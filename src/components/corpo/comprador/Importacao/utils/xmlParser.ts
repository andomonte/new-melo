/**
 * Parser de XML da DIe (Declaração de Importação eletrônica)
 * Formato: SEFAZ-AM, namespace http://www.sefaz.am.gov.br/die
 *
 * Valores numéricos no XML são strings padded com zeros:
 * - Monetários (2 casas): dividir por 100
 * - Taxa dólar (4 casas): dividir por 10000
 * - Quantidades (5 casas): dividir por 100000 (campo qtdItem)
 * - Preço unitário (7 casas): dividir por 10000000 (campo vlUnitario, vlTotal do item = /100)
 * - Peso (6 casas): dividir por 1000000
 * - Alíquota ICMS (3 casas): dividir por 1000
 */

import type {
  DieXmlParsed,
  DieXmlAdicao,
  DieXmlItem,
  DieXmlContrato,
} from '../types/importacao';

const NS = 'http://www.sefaz.am.gov.br/die';

function getTagText(parent: Element, tagName: string): string {
  const el =
    parent.getElementsByTagNameNS(NS, tagName)[0] ||
    parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

function toMoney(raw: string): number {
  return parseInt(raw || '0', 10) / 100;
}

function toTaxa(raw: string): number {
  return parseInt(raw || '0', 10) / 10000;
}

function toQtd(raw: string): number {
  return parseInt(raw || '0', 10) / 100000;
}

function toPrecoUnit(raw: string): number {
  return parseInt(raw || '0', 10) / 10000000;
}

function toPeso(raw: string): number {
  return parseInt(raw || '0', 10) / 1000000;
}

function toAliquota(raw: string): number {
  return parseInt(raw || '0', 10) / 1000;
}

function formatDate(raw: string): string {
  if (!raw || raw.length !== 8) return raw;
  return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
}

/**
 * Via de transporte → tpViaTransp (NT 2013.005): 1 Marítima, 2 Fluvial, 3 Lacustre,
 * 4 Aérea, 5 Postal, 6 Ferroviária, 7 Rodoviária, 8 Conduto, 9 Meios próprios, 10 Ficta.
 * O código do Siscomex já segue essa tabela; se não der p/ alinhar, retorna undefined
 * (usuário escolhe na tela). Navio→1, Avião→4 por nome, como pediu a regra.
 */
function mapViaTransporte(codigo: string, nome: string): number | undefined {
  const c = parseInt(codigo || '0', 10);
  if (c >= 1 && c <= 10) return c;
  const n = (nome || '').toUpperCase();
  if (/MAR[IÍ]T|NAVIO/.test(n)) return 1;
  if (/FLUV/.test(n)) return 2;
  if (/LACUS/.test(n)) return 3;
  if (/A[EÉ]RE|AVI[AÃ]O/.test(n)) return 4;
  if (/POST/.test(n)) return 5;
  if (/FERRO/.test(n)) return 6;
  if (/RODO/.test(n)) return 7;
  return undefined;
}

function extractFromInfoCompl(info: string): {
  navio?: string;
  dataEntradaBrasil?: string;
  inscricaoSuframa?: string;
  contratos: DieXmlContrato[];
} {
  const contratos: DieXmlContrato[] = [];
  let navio: string | undefined;
  let dataEntradaBrasil: string | undefined;
  let inscricaoSuframa: string | undefined;

  // NAVIO. MAYA BAY VG.0LD98N1MA
  const navioMatch = info.match(/NAVIO\.\s*([^/]+)/i);
  if (navioMatch) {
    navio = navioMatch[1].trim().replace(/\s+VG\..*/, '');
  }

  // ENTRADA. 02.11.2025
  const entradaMatch = info.match(/ENTRADA\.\s*(\d{2}\.\d{2}\.\d{4})/i);
  if (entradaMatch) {
    const parts = entradaMatch[1].split('.');
    dataEntradaBrasil = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // INSCRICAO SUFRAMA. 20.0103.41-5
  const suframaMatch = info.match(/INSCRICAO SUFRAMA\.\s*([\d.\-]+)/i);
  if (suframaMatch) {
    inscricaoSuframa = suframaMatch[1].trim();
  }

  // Mapa de cotações (moeda -> BRL) impressas no txInfoCompl:
  //   "TAXA DOLAR EUA R$ 5,2204" / "TAXA EURO R$ 5,9546" / "TAXA CNY R$ 0,7527"
  const taxasMoeda: Record<string, number> = {};
  const usd = info.match(/TAXA\s+D[OÓ]LAR(?:\s+EUA)?\s+R\$\s*([\d.,]+)/i);
  if (usd) taxasMoeda.USD = brToNumber(usd[1]);
  const eur = info.match(/TAXA\s+EURO\s+R\$\s*([\d.,]+)/i);
  if (eur) taxasMoeda.EUR = brToNumber(eur[1]);
  const cny = info.match(/TAXA\s+(?:CNY|YUAN|IUAN|RENMINBI)\s+R\$\s*([\d.,]+)/i);
  if (cny) taxasMoeda.CNY = brToNumber(cny[1]);
  const jpy = info.match(/TAXA\s+(?:JPY|IENE)\s+R\$\s*([\d.,]+)/i);
  if (jpy) taxasMoeda.JPY = brToNumber(jpy[1]);
  const gbp = info.match(/TAXA\s+(?:GBP|LIBRA)\s+R\$\s*([\d.,]+)/i);
  if (gbp) taxasMoeda.GBP = brToNumber(gbp[1]);

  const taxaUsd = taxasMoeda.USD || 0; // dólar -> BRL (bridge para converter tudo em USD)

  // CONTRATO CAMBIO NO. 000529545244 - US$ 17.328,50
  // Também captura moedas estrangeiras: "- EUR 6.387,62", "- CNY 122.273,81"
  const contratoRegex = /CONTRATO CAMBIO NO\.\s*(\d+)\s*-\s*(US\$|R\$|[A-Z]{3})\s*([\d.,]+)/gi;
  let match;
  while ((match = contratoRegex.exec(info)) !== null) {
    const token = match[2].toUpperCase();
    const moeda = token === 'US$' ? 'USD' : token === 'R$' ? 'BRL' : token;
    const valor = brToNumber(match[3]);
    const taxaMoeda = taxasMoeda[moeda]; // moeda do contrato -> BRL
    const vlReais = taxaMoeda ? valor * taxaMoeda : undefined;
    // Valor em dólar: BRL / dólar. Para contrato já em USD, é o próprio valor.
    let vlUsd: number | undefined;
    if (moeda === 'USD') vlUsd = valor;
    else if (vlReais !== undefined && taxaUsd > 0) vlUsd = vlReais / taxaUsd;

    contratos.push({
      numero: match[1],
      valorUsd: valor,
      moeda,
      taxaMoeda,
      vlReais,
      taxaUsd: taxaUsd || undefined,
      vlUsd,
      // Taxas vieram do próprio XML (ficam como XML até serem confirmadas no
      // Contas a Pagar pelo nº do contrato, ou trocadas por PTAX/manual).
      origemTaxa: taxaUsd ? 'XML' : undefined,
      origemCambio: taxaMoeda ? 'XML' : undefined,
    });
  }

  return { navio, dataEntradaBrasil, inscricaoSuframa, contratos };
}

// ---------------------------------------------------------------------------
// Parser do formato DI do Siscomex (federal): <ListaDeclaracoes><declaracaoImportacao>
// Mapeado para o MESMO DieXmlParsed, para não mudar nada no fluxo a jusante.
// Diferenças tratadas: tags próprias; FOB/frete/seguro em USD (…TotalDolares /
// condicaoVendaValorMoeda); impostos em R$ usando o "valor a recolher" (ZFM: II/IPI
// suspensos = 0, PIS/COFINS reais); NCM por adição; itens = <mercadoria>.
// ---------------------------------------------------------------------------

/** Texto de um filho DIRETO (evita pegar tag homônima aninhada em <adicao>/<icms>). */
function childText(parent: Element, tag: string): string {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tag) {
      return parent.children[i].textContent?.trim() || '';
    }
  }
  return '';
}

/** Monetário padded (2 casas) → divide por 100. */
function moneyBR(raw: string): number {
  return parseInt(raw || '0', 10) / 100;
}

/** Converte "5.2204" / "4.000,00" (pt-BR) em número. */
function brToNumber(s: string): number {
  return parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;
}

/** Taxa dólar / Siscomex / Capatazia que só existem no texto da info complementar. */
function extractExtraInfoCompl(info: string): {
  taxaDolar: number;
  siscomex: number;
  capatazia: number;
} {
  const td = info.match(/TAXA\s+D[OÓ]LAR[^R]*R\$\s*([\d.,]+)/i);
  const sc = info.match(/SISCOMEX\s*R\$\s*([\d.,]+)/i);
  const cp = info.match(/CAPATAZIA[^R]*R\$\s*([\d.,]+)/i);
  return {
    taxaDolar: td ? brToNumber(td[1]) : 0,
    siscomex: sc ? brToNumber(sc[1]) : 0,
    capatazia: cp ? brToNumber(cp[1]) : 0,
  };
}

function parseSiscomexDi(di: Element): DieXmlParsed {
  const info = childText(di, 'informacaoComplementar');
  const base = extractFromInfoCompl(info); // navio/entrada/suframa/contratos
  const extra = extractExtraInfoCompl(info); // taxa dólar/siscomex/capatazia

  const cdImportador = childText(di, 'importadorNumero');
  const nomeImportador = childText(di, 'importadorNome').trim();

  const adicoesEls = di.getElementsByTagName('adicao');
  const adicoes: DieXmlAdicao[] = [];
  let somaII = 0;
  let somaIPI = 0;
  let somaPisCofins = 0;

  for (let i = 0; i < adicoesEls.length; i++) {
    const ad = adicoesEls[i];
    const numAdicao = parseInt(getTagText(ad, 'numeroAdicao') || '0', 10);
    const ncm = getTagText(ad, 'dadosMercadoriaCodigoNcm');

    // Impostos efetivamente devidos (a recolher) — em R$. ZFM: II/IPI suspensos = 0.
    const ii = moneyBR(getTagText(ad, 'iiAliquotaValorRecolher'));
    const ipi = moneyBR(getTagText(ad, 'ipiAliquotaValorRecolher'));
    const pisCofins =
      moneyBR(getTagText(ad, 'pisPasepAliquotaValorRecolher')) +
      moneyBR(getTagText(ad, 'cofinsAliquotaValorRecolher'));
    somaII += ii;
    somaIPI += ipi;
    somaPisCofins += pisCofins;

    // Itens = <mercadoria> (NCM herdado da adição)
    const mercEls = ad.getElementsByTagName('mercadoria');
    const itens: DieXmlItem[] = [];
    for (let j = 0; j < mercEls.length; j++) {
      const m = mercEls[j];
      const qtd = toQtd(getTagText(m, 'quantidade'));
      const vlUnitario = toPrecoUnit(getTagText(m, 'valorUnitario')); // USD
      itens.push({
        numItem: parseInt(getTagText(m, 'numeroSequencialItem') || '0', 10),
        numAdicao,
        cdNcm: ncm,
        descricao: getTagText(m, 'descricaoMercadoria')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/^\[\d+\]\s*/, ''), // remove o prefixo "[000001] "
        qtd,
        unidade: getTagText(m, 'unidadeMedida').trim(),
        vlUnitario,
        vlTotal: Math.round(qtd * vlUnitario * 100) / 100,
      });
    }

    adicoes.push({
      numAdicao,
      nomeFornecedor: getTagText(ad, 'fornecedorNome').trim(),
      cdImportador,
      nomeImportador,
      vlFob: moneyBR(getTagText(ad, 'condicaoVendaValorMoeda')), // USD
      vlFrete: moneyBR(getTagText(ad, 'freteValorMoedaNegociada')), // USD
      vlSeguro: moneyBR(getTagText(ad, 'seguroValorMoedaNegociada')), // USD
      vlIi: ii,
      vlIpi: ipi,
      vlPisCofins: pisCofins,
      vlPesoLiquido: toPeso(getTagText(ad, 'dadosMercadoriaPesoLiquido')),
      cdTributacao: getTagText(ad, 'iiRegimeTributacaoCodigo'),
      vlBcIcms: moneyBR(getTagText(ad, 'iiBaseCalculo')),
      vlIcms: 0, // DI federal não traz ICMS (estadual); ZFM = exonerado
      vlIcmsSI: 0,
      itens,
    });
  }

  // Taxa dólar: do texto; senão, razão VA(R$)/VA(US$).
  const vaReais = moneyBR(childText(di, 'localDescargaTotalReais'));
  const vaDolares = moneyBR(childText(di, 'localDescargaTotalDolares'));
  const taxaDolar =
    extra.taxaDolar ||
    (vaDolares > 0 ? Math.round((vaReais / vaDolares) * 10000) / 10000 : 0);

  // Nota de nacionalização: peso bruto, data de desembaraço, via de transporte, espécie
  const pesoBruto = toPeso(childText(di, 'cargaPesoBruto'));
  const dataDesembaraco = formatDate(childText(di, 'dataDesembaraco'));
  const viaTransporte = mapViaTransporte(
    childText(di, 'viaTransporteCodigo'),
    childText(di, 'viaTransporteNome'),
  );
  const embalagemEl = di.getElementsByTagName('embalagem')[0];
  const especie = embalagemEl
    ? (embalagemEl.getElementsByTagName('nomeEmbalagem')[0]?.textContent?.trim() || '')
    : '';

  return {
    tipoDIe: (childText(di, 'tipoDeclaracaoNome') || childText(di, 'tipoDeclaracaoCodigo')).slice(0, 60),
    nrDocumento: childText(di, 'numeroDI'),
    dtDocumento: formatDate(childText(di, 'dataRegistro')),
    vlFob: moneyBR(childText(di, 'localEmbarqueTotalDolares')), // USD
    vlFrete: moneyBR(childText(di, 'freteTotalDolares')), // USD
    vlSeguro: moneyBR(childText(di, 'seguroTotalDolares')), // USD
    vlII: somaII,
    vlIPI: somaIPI,
    vlPisCofins: somaPisCofins,
    vlTaxasDiversas: extra.siscomex,
    vlTaxasCapatazia: extra.capatazia,
    vlTaxaDolar: taxaDolar,
    vlPesoLiquido: toPeso(childText(di, 'cargaPesoLiquido')),
    cdRecintoAduaneiro: childText(di, 'armazenamentoRecintoAduaneiroCodigo'),
    cdPaisProcedencia: childText(di, 'cargaPaisProcedenciaCodigo'),
    qtdeAdicoes: parseInt(childText(di, 'totalAdicoes') || String(adicoes.length), 10),
    txInfoCompl: info,
    pesoBruto,
    dataDesembaraco,
    viaTransporte,
    especie,
    navio: base.navio,
    dataEntradaBrasil: base.dataEntradaBrasil,
    inscricaoSuframa: base.inscricaoSuframa,
    contratos: base.contratos,
    adicoes,
  };
}

export function parseDieXml(xmlString: string): DieXmlParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('XML inválido: ' + errorNode.textContent);
  }

  const infDIe =
    doc.getElementsByTagNameNS(NS, 'InfDIe')[0] ||
    doc.getElementsByTagName('InfDIe')[0];

  if (!infDIe) {
    // Fallback: DI do Siscomex (federal) — <ListaDeclaracoes><declaracaoImportacao>
    const diFederal = doc.getElementsByTagName('declaracaoImportacao')[0];
    if (diFederal) return parseSiscomexDi(diFederal);
    throw new Error(
      'Formato de XML não reconhecido. Esperado DIe da SEFAZ-AM (<InfDIe>) ou DI do Siscomex (<declaracaoImportacao>).',
    );
  }

  const txInfoCompl = getTagText(infDIe, 'txInfoCompl');
  const infoExtraida = extractFromInfoCompl(txInfoCompl);

  // Parse adições
  const adicoesEls =
    infDIe.getElementsByTagNameNS(NS, 'adicao').length > 0
      ? infDIe.getElementsByTagNameNS(NS, 'adicao')
      : infDIe.getElementsByTagName('adicao');

  const adicoes: DieXmlAdicao[] = [];
  for (let i = 0; i < adicoesEls.length; i++) {
    const ad = adicoesEls[i];
    const numAdicao = parseInt(getTagText(ad, 'numAdicao') || '0', 10);

    // Parse itens da adição
    const itensEls =
      ad.getElementsByTagNameNS(NS, 'itemAdicao').length > 0
        ? ad.getElementsByTagNameNS(NS, 'itemAdicao')
        : ad.getElementsByTagName('itemAdicao');

    const itens: DieXmlItem[] = [];
    for (let j = 0; j < itensEls.length; j++) {
      const it = itensEls[j];
      itens.push({
        numItem: parseInt(getTagText(it, 'numItem') || '0', 10),
        numAdicao,
        cdNcm: getTagText(it, 'cdNcmItem'),
        descricao: getTagText(it, 'txDescricaoDestalhada').replace(/\s+/g, ' ').trim(),
        qtd: toQtd(getTagText(it, 'qtdItem')),
        unidade: getTagText(it, 'unidadeMedida').trim(),
        vlUnitario: toPrecoUnit(getTagText(it, 'vlUnitario')),
        vlTotal: toMoney(getTagText(it, 'vlTotal')),
      });
    }

    adicoes.push({
      numAdicao,
      nomeFornecedor: getTagText(ad, 'nomeFornecedor').trim(),
      cdImportador: getTagText(ad, 'cdImportador'),
      nomeImportador: getTagText(ad, 'nomeImportador').trim(),
      vlFob: toMoney(getTagText(ad, 'vlFob')),
      vlFrete: toMoney(getTagText(ad, 'vlFrete')),
      vlSeguro: toMoney(getTagText(ad, 'vlSeguro')),
      vlIi: toMoney(getTagText(ad, 'vlIi')),
      vlIpi: toMoney(getTagText(ad, 'vlIpi')),
      vlPisCofins: toMoney(getTagText(ad, 'vlPisCofins')),
      vlPesoLiquido: toPeso(getTagText(ad, 'vlPesoLiquido')),
      cdTributacao: getTagText(ad, 'cdTributacao'),
      vlBcIcms: toMoney(getTagText(ad, 'vlBcIcms')),
      vlIcms: toMoney(getTagText(ad, 'vlIcms')),
      vlIcmsSI: toMoney(getTagText(ad, 'vlIcmsSI')),
      itens,
    });
  }

  return {
    tipoDIe: getTagText(infDIe, 'tipoDIe'),
    nrDocumento: getTagText(infDIe, 'nrDocumento'),
    dtDocumento: formatDate(getTagText(infDIe, 'dtDocumento')),
    vlFob: toMoney(getTagText(infDIe, 'vlFob')),
    vlFrete: toMoney(getTagText(infDIe, 'vlFrete')),
    vlSeguro: toMoney(getTagText(infDIe, 'vlSeguro')),
    vlII: toMoney(getTagText(infDIe, 'vlII')),
    vlIPI: toMoney(getTagText(infDIe, 'vlIPI')),
    vlPisCofins: toMoney(getTagText(infDIe, 'vlPisCofins')),
    vlTaxasDiversas: toMoney(getTagText(infDIe, 'vlTaxasDiversas')),
    vlTaxasCapatazia: toMoney(getTagText(infDIe, 'vlTaxasCapatazia')),
    vlTaxaDolar: toTaxa(getTagText(infDIe, 'vlTaxaDolar')),
    vlPesoLiquido: toPeso(getTagText(infDIe, 'vlPesoLiquido')),
    cdRecintoAduaneiro: getTagText(infDIe, 'cdRecintoAduaneiro'),
    cdPaisProcedencia: getTagText(infDIe, 'cdPaisProcedencia'),
    qtdeAdicoes: parseInt(getTagText(infDIe, 'qtdeAdicoes') || '0', 10),
    txInfoCompl,
    // Nota de nacionalização (best-effort no layout DIe SEFAZ-AM; campos editáveis na tela)
    pesoBruto: toPeso(getTagText(infDIe, 'cargaPesoBruto') || getTagText(infDIe, 'pesoBruto')),
    dataDesembaraco: formatDate(getTagText(infDIe, 'dtDesembaraco') || getTagText(infDIe, 'dataDesembaraco')),
    viaTransporte: mapViaTransporte(
      getTagText(infDIe, 'cdViaTransporte') || getTagText(infDIe, 'viaTransporteCodigo'),
      getTagText(infDIe, 'viaTransporte') || getTagText(infDIe, 'viaTransporteNome'),
    ),
    especie: getTagText(infDIe, 'nomeEmbalagem') || getTagText(infDIe, 'especie') || '',
    navio: infoExtraida.navio,
    dataEntradaBrasil: infoExtraida.dataEntradaBrasil,
    inscricaoSuframa: infoExtraida.inscricaoSuframa,
    contratos: infoExtraida.contratos,
    adicoes,
  };
}

/**
 * Converte dados parseados do XML para o formato de ImportacaoCabecalho parcial
 */
export function xmlToCabecalho(parsed: DieXmlParsed): Record<string, any> {
  return {
    nro_di: parsed.nrDocumento,
    data_di: parsed.dtDocumento,
    tipo_die: parsed.tipoDIe,
    taxa_dolar: parsed.vlTaxaDolar,
    total_mercadoria: parsed.vlFob,
    frete: parsed.vlFrete,
    seguro: parsed.vlSeguro,
    thc: parsed.vlTaxasCapatazia,
    total_cif: parsed.vlFob + parsed.vlFrete + parsed.vlSeguro,
    ii: parsed.vlII,
    ipi: parsed.vlIPI,
    pis_cofins: parsed.vlPisCofins,
    siscomex: parsed.vlTaxasDiversas,
    peso_liquido: parsed.vlPesoLiquido,
    recinto_aduaneiro: parsed.cdRecintoAduaneiro,
    pais_procedencia: parsed.cdPaisProcedencia,
    qtd_adicoes: parsed.qtdeAdicoes,
    navio: parsed.navio,
    data_entrada_brasil: parsed.dataEntradaBrasil,
    inscricao_suframa: parsed.inscricaoSuframa,
    // Nota de nacionalização (do XML da DI)
    peso_bruto: parsed.pesoBruto,
    data_desembaraco: parsed.dataDesembaraco || undefined,
    via_transporte: parsed.viaTransporte,
    especie: parsed.especie || undefined,
  };
}

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

  // CONTRATO CAMBIO NO. 000529545244 - US$ 17.328,50
  const contratoRegex = /CONTRATO CAMBIO NO\.\s*(\d+)\s*-\s*US\$\s*([\d.,]+)/gi;
  let match;
  while ((match = contratoRegex.exec(info)) !== null) {
    const valorStr = match[2].replace(/\./g, '').replace(',', '.');
    contratos.push({
      numero: match[1],
      valorUsd: parseFloat(valorStr),
    });
  }

  return { navio, dataEntradaBrasil, inscricaoSuframa, contratos };
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
    throw new Error('Elemento InfDIe não encontrado no XML');
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
  };
}

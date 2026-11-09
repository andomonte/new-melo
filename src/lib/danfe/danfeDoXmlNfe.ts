// src/lib/danfe/danfeDoXmlNfe.ts
//
// Monta os dados do DANFE a partir do XML da NF-e (o que foi de fato para a SEFAZ).
// Usado na nota de NACIONALIZAÇÃO: os itens da fatura (dbitvenda) vêm agrupados por
// produto e fora da ordem da DI, então o DANFE tem de sair do XML — mesmos itens, na
// mesma ordem (adição/item), mesmos totais e as mesmas informações complementares.
//
// Devolve os mesmos "shapes" que gerarDanfeNacionalizacaoHtml espera
// (fatura, produtos, venda, dadosEmpresa, dadosNFe).

type Any = Record<string, any>;

const decodificar = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

/** Primeiro bloco <tag ...>...</tag> (ou '' se não houver). */
const bloco = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : '';
};

/** Texto da primeira <tag> simples dentro do trecho. */
const txt = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? decodificar(m[1]).trim() : '';
};

const n = (v: string): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export interface DanfeDoXml {
  fatura: Any;
  produtos: Any[];
  venda: Any;
  emitente: Any;
  dadosNFe: Any;
  homologacao: boolean;
  entrada: boolean;
}

export function danfeDoXmlNfe(
  xml: string,
  extra: { protocolo?: string | null; dataAutorizacao?: string | Date | null } = {},
): DanfeDoXml {
  const inf = bloco(xml, 'infNFe');
  if (!inf) throw new Error('XML da NF-e sem <infNFe>.');

  const ide = bloco(inf, 'ide');
  const emit = bloco(inf, 'emit');
  const enderEmit = bloco(emit, 'enderEmit');
  const dest = bloco(inf, 'dest');
  const enderDest = bloco(dest, 'enderDest');
  const icmsTot = bloco(inf, 'ICMSTot');
  const ibsCbsTot = bloco(inf, 'IBSCBSTot');
  const transp = bloco(inf, 'transp');
  const pag = bloco(inf, 'pag');
  const infAdic = bloco(inf, 'infAdic');

  const chave = (xml.match(/<infNFe[^>]*Id="NFe(\d{44})"/) || [])[1] || '';
  // Protocolo: o XML guardado (xmlremessa) é só a NFe assinada; o protocolo vem do
  // retorno (nProt) quando houver, senão do que o chamador informar.
  const nProt = txt(xml, 'nProt') || String(extra.protocolo || '');

  // ---- Itens: na ordem do XML (nItem) ----
  const produtos = [...inf.matchAll(/<det nItem="(\d+)">([\s\S]*?)<\/det>/g)].map((m) => {
    const d = m[2];
    const prod = bloco(d, 'prod');
    const icms = bloco(d, 'ICMS');
    const ipi = bloco(d, 'IPI');
    const adi = bloco(prod, 'adi');
    return {
      nItem: Number(m[1]),
      codprod: txt(prod, 'cProd'),
      descr: txt(prod, 'xProd'),
      ref: '',
      ncm: txt(prod, 'NCM'),
      origem: txt(icms, 'orig') || '0',
      cst: txt(icms, 'CST') || txt(icms, 'CSOSN') || '00',
      cfop: txt(prod, 'CFOP'),
      unimed: txt(prod, 'uCom'),
      qtd: n(txt(prod, 'qCom')),
      prunit: n(txt(prod, 'vUnCom')),
      total_item: n(txt(prod, 'vProd')),
      baseicms: n(txt(icms, 'vBC')),
      totalicms: n(txt(icms, 'vICMS')),
      aliquota_icms: n(txt(icms, 'pICMS')),
      totalipi: n(txt(ipi, 'vIPI')),
      aliquota_ipi: n(txt(ipi, 'pIPI')),
      aliquota_ibs: n(txt(bloco(d, 'gIBSUF'), 'pIBSUF')),
      aliquota_cbs: n(txt(bloco(d, 'gCBS'), 'pCBS')),
      valor_ibs: n(txt(bloco(d, 'gIBSCBS'), 'vIBS')),
      valor_cbs: n(txt(bloco(d, 'gCBS'), 'vCBS')),
      nAdicao: n(txt(adi, 'nAdicao')),
      nSeqAdic: n(txt(adi, 'nSeqAdic')),
    };
  });

  const modFrete = txt(transp, 'modFrete');
  const tPag = txt(pag, 'tPag');
  const xLgr = txt(enderDest, 'xLgr');
  const xCpl = txt(enderDest, 'xCpl');

  const fatura = {
    natureza: txt(ide, 'natOp'),
    nroform: txt(ide, 'nNF'),
    serie: txt(ide, 'serie'),
    cfop2: '', // CFOP por item (vem do XML)
    nomefant: txt(dest, 'xNome'),
    cpfcgc: txt(dest, 'CNPJ') || txt(dest, 'CPF') || txt(dest, 'idEstrangeiro'),
    ender: xCpl ? `${xLgr} - ${xCpl}` : xLgr,
    numero: txt(enderDest, 'nro'),
    bairro: txt(enderDest, 'xBairro'),
    cep: txt(enderDest, 'CEP'),
    cidade: txt(enderDest, 'xMun'),
    uf: txt(enderDest, 'UF'),
    fone: txt(enderDest, 'fone'),
    iest: txt(dest, 'IE'),
    totalprod: n(txt(icmsTot, 'vProd')),
    baseicms: n(txt(icmsTot, 'vBC')),
    valor_icms: n(txt(icmsTot, 'vICMS')),
    baseicms_subst: n(txt(icmsTot, 'vBCST')),
    valor_icms_st: n(txt(icmsTot, 'vST')),
    valor_ipi: n(txt(icmsTot, 'vIPI')),
    vlrfrete: n(txt(icmsTot, 'vFrete')),
    vlrseg: n(txt(icmsTot, 'vSeg')),
    desconto: n(txt(icmsTot, 'vDesc')),
    vlrdesp: n(txt(icmsTot, 'vOutro')),
    totalnf: n(txt(icmsTot, 'vNF')),
    // Valores "oficiais" do XML: o DANFE usa estes em vez de recalcular.
    vNF: n(txt(icmsTot, 'vNF')),
    vIBS: ibsCbsTot ? n(txt(bloco(ibsCbsTot, 'gIBS'), 'vIBS')) : undefined,
    vCBS: ibsCbsTot ? n(txt(bloco(ibsCbsTot, 'gCBS'), 'vCBS')) : undefined,
    destfrete: modFrete !== '' ? Number(modFrete) + 1 : undefined, // dbfatura é base 1
    dupTexto: tPag === '90' ? 'SEM PAGAMENTO' : 'A VISTA',
    aliquota_ibs: produtos[0]?.aliquota_ibs ?? 0.1,
    aliquota_cbs: produtos[0]?.aliquota_cbs ?? 0.9,
  };

  const emitente = {
    nomecontribuinte: txt(emit, 'xNome'),
    nomefantasia: txt(emit, 'xFant'),
    logradouro: txt(enderEmit, 'xLgr'),
    numero: txt(enderEmit, 'nro'),
    bairro: txt(enderEmit, 'xBairro'),
    cep: txt(enderEmit, 'CEP'),
    municipio: txt(enderEmit, 'xMun'),
    uf: txt(enderEmit, 'UF'),
    telefone: txt(enderEmit, 'fone'),
    inscricaoestadual: txt(emit, 'IE'),
    cgc: txt(emit, 'CNPJ') || txt(emit, 'CPF'),
    crt: txt(emit, 'CRT'),
  };

  const venda = {
    nrovenda: '',
    obs: '',
    transp: txt(bloco(transp, 'transporta'), 'xNome'),
    // Texto exato das informações complementares da nota.
    infCpl: txt(infAdic, 'infCpl'),
    infAdFisco: txt(infAdic, 'infAdFisco'),
  };

  const dadosNFe = {
    chaveAcesso: chave,
    protocolo: nProt || undefined,
    numeroNFe: fatura.nroform,
    serieNFe: fatura.serie,
    dataEmissao: txt(ide, 'dhEmi'),
    valorTotal: fatura.vNF,
  };

  return {
    fatura,
    produtos,
    venda,
    emitente,
    dadosNFe,
    homologacao: txt(ide, 'tpAmb') === '2',
    entrada: txt(ide, 'tpNF') === '0',
  };
}

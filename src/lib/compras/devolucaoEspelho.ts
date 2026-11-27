/**
 * Espelho fiscal da NF de devolução de compra (porte do FATURAMENTOS.GER_FAT_AUX_DEVOLUCAO,
 * ramo ENTRADA/FORNECEDOR, do Delphi).
 *
 * Diferença de fonte: o Delphi lê os impostos do item da entrada (DBITENT.FIS_*), mas as
 * entradas geradas pelo web não preenchem esses campos. Aqui os impostos saem do XML da NF
 * do fornecedor (dbnfe_ent.xml_completo), item a item, ligados ao produto por
 * nfe_item_associacao — e são aplicados na proporção da quantidade devolvida, como no Delphi
 * (VPROPORCAO = devolvida / quantidade do item).
 *
 * Regras do Delphi mantidas: ICMS = base × proporção × alíquota; IPI e PIS/COFINS
 * proporcionais com o CST do fornecedor (já é CST de saída); a ST vai para "outras
 * despesas" (acréscimo) com base/valor no texto complementar; ICMS desonerado (Suframa)
 * proporcional só quando a empresa é matriz (12º dígito do CNPJ = '1').
 */
import { parseStringPromise } from 'xml2js';

type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const num = (v: any) => (v == null || v === '' ? 0 : Number(v) || 0);

/**
 * CFOP de devolução a partir do CFOP da NF do fornecedor e do CST de ICMS.
 * Validado no histórico do Delphi: 2403/1102-com-CST-60 → x411; sem ST → x202.
 * O 1º dígito do CFOP do fornecedor (5 = mesma UF, 6 = outra UF) vale para a devolução.
 */
export function cfopDevolucao(cfopFornecedor: string | number | null | undefined, cstIcms?: string | null): string {
  const c = String(cfopFornecedor ?? '').replace(/\D/g, '');
  const prefixo = c.charAt(0) === '6' ? '6' : c.charAt(0) === '7' ? '7' : '5';
  const final = c.slice(1);
  const cst = String(cstIcms ?? '').replace(/\D/g, '').slice(-2);
  const comSt = ['401', '402', '403', '404', '405', '408', '409', '410', '411'].includes(final)
    || ['10', '30', '60', '70'].includes(cst);
  if (prefixo === '7') return '7202';
  return `${prefixo}${comSt ? '411' : '202'}`;
}

export function cfopValidoDevolucao(cfop: string): boolean {
  return /^[567]\d{3}$/.test(String(cfop ?? ''));
}

/** Impostos de um <det> do XML do fornecedor. */
interface DetXml {
  nItem: number;
  cfop: string;
  ncm: string;
  cest: string;
  uCom: string;
  qCom: number;
  vProd: number;
  vDesc: number;
  vOutro: number;
  orig: string;
  cstIcms: string;
  vBC: number;
  pICMS: number;
  vICMS: number;
  vBCST: number;
  vICMSST: number;
  vICMSDeson: number;
  motDesICMS: string;
  cstIpi: string;
  vBCIpi: number;
  pIPI: number;
  vIPI: number;
  cstPis: string;
  vBCPis: number;
  pPIS: number;
  vPIS: number;
  cstCofins: string;
  vBCCofins: number;
  pCOFINS: number;
  vCOFINS: number;
}

const primeiroGrupo = (o: any) => (o && typeof o === 'object' ? (Object.values(o)[0] as any) ?? {} : {});
const txt = (v: any) => (v == null ? '' : typeof v === 'object' ? String(v._ ?? '') : String(v));

export async function lerItensXmlNfe(xml: string): Promise<Map<number, DetXml>> {
  const j = await parseStringPromise(xml, {
    explicitArray: false,
    tagNameProcessors: [(n: string) => n.split(':').pop() || n],
  });
  const inf = j?.nfeProc?.NFe?.infNFe ?? j?.NFe?.infNFe ?? j?.infNFe;
  const dets = inf?.det ? (Array.isArray(inf.det) ? inf.det : [inf.det]) : [];
  const mapa = new Map<number, DetXml>();
  for (const d of dets) {
    const nItem = Number(d?.$?.nItem ?? 0);
    const prod = d?.prod ?? {};
    const imp = d?.imposto ?? {};
    const icms = primeiroGrupo(imp.ICMS);
    const ipiG = imp.IPI ?? {};
    const ipi = ipiG.IPITrib ?? ipiG.IPINT ?? {};
    const pis = primeiroGrupo(imp.PIS);
    const cof = primeiroGrupo(imp.COFINS);
    mapa.set(nItem, {
      nItem,
      cfop: txt(prod.CFOP),
      ncm: txt(prod.NCM),
      cest: txt(prod.CEST),
      uCom: txt(prod.uCom),
      qCom: num(txt(prod.qCom)),
      vProd: num(txt(prod.vProd)),
      vDesc: num(txt(prod.vDesc)),
      vOutro: num(txt(prod.vOutro)),
      orig: txt(icms.orig) || '0',
      cstIcms: txt(icms.CST) || (icms.CSOSN ? '90' : ''),
      vBC: num(txt(icms.vBC)),
      pICMS: num(txt(icms.pICMS)),
      vICMS: num(txt(icms.vICMS)),
      vBCST: num(txt(icms.vBCST)),
      vICMSST: num(txt(icms.vICMSST)),
      vICMSDeson: num(txt(icms.vICMSDeson)),
      motDesICMS: txt(icms.motDesICMS),
      cstIpi: txt(ipi.CST),
      vBCIpi: num(txt(ipi.vBC)),
      pIPI: num(txt(ipi.pIPI)),
      vIPI: num(txt(ipi.vIPI)),
      cstPis: txt(pis.CST),
      vBCPis: num(txt(pis.vBC)),
      pPIS: num(txt(pis.pPIS)),
      vPIS: num(txt(pis.vPIS)),
      cstCofins: txt(cof.CST),
      vBCCofins: num(txt(cof.vBC)),
      pCOFINS: num(txt(cof.pCOFINS)),
      vCOFINS: num(txt(cof.vCOFINS)),
    });
  }
  return mapa;
}

/** Uma linha da NF de devolução (um item da NF do fornecedor, na quantidade devolvida). */
export interface LinhaEspelho {
  chave: string; // codprod|nItem — identifica a linha para editar o CFOP
  codprod: string;
  descr: string;
  ref: string;
  unidade: string;
  codreq: string | null;
  motivo: string | null;
  nItemNf: number;
  qtd: number;
  prunit: number;
  totalproduto: number;
  cfopFornecedor: string;
  cfop: string;
  ncm: string;
  cest: string;
  csticms: string; // origem + CST (3 dígitos), como no Delphi
  aliqIcms: number;
  baseIcms: number;
  valorIcms: number;
  icmsDeson: number;
  motDesIcms: string;
  cstipi: string;
  aliqIpi: number;
  baseIpi: number;
  valorIpi: number;
  cstpis: string;
  aliqPis: number;
  basePis: number;
  valorPis: number;
  cstcofins: string;
  aliqCofins: number;
  baseCofins: number;
  valorCofins: number;
  baseSt: number;
  valorSt: number;
  outros: number; // vOutro do fornecedor (proporcional); a ST soma aqui na fatura
  desconto: number;
}

export interface EspelhoDevolucao {
  devId: string;
  status: string;
  codent: string;
  codnfeEnt: string | null;
  nfFornecedor: string;
  serieFornecedor: string;
  chaveRef: string;
  codvenda: string | null;
  nrovenda: string | null;
  cliente: { codcli: string; nome: string; cpfcgc: string; uf: string; iest: string; codmunicipio: string };
  empresa: { cgc: string; uf: string; matriz: boolean };
  interestadual: boolean;
  linhas: LinhaEspelho[];
  totais: {
    produtos: number;
    ipi: number;
    st: number;
    baseSt: number;
    outros: number;
    desconto: number;
    icmsDeson: number;
    baseIcms: number;
    icms: number;
    nf: number;
  };
  infCompl: string;
  obs: string;
  pendencias: string[]; // impedem a emissão
}

/** Soma os totais da NF como o PROCESSO_DEVOLUCAO (ST e outros entram em "despesas"). */
export function totalizarEspelho(linhas: LinhaEspelho[]): EspelhoDevolucao['totais'] {
  const s = (f: (l: LinhaEspelho) => number) => r2(linhas.reduce((a, l) => a + f(l), 0));
  const produtos = s((l) => l.totalproduto);
  const ipi = s((l) => l.valorIpi);
  const st = s((l) => l.valorSt);
  const outros = s((l) => l.outros);
  const desconto = s((l) => l.desconto);
  const icmsDeson = s((l) => l.icmsDeson);
  return {
    produtos,
    ipi,
    st,
    baseSt: s((l) => l.baseSt),
    outros,
    desconto,
    icmsDeson,
    baseIcms: s((l) => l.baseIcms),
    icms: s((l) => l.valorIcms),
    nf: r2(produtos + ipi + st + outros - desconto - icmsDeson),
  };
}

/**
 * Monta o espelho da devolução aberta `devId`. Só leitura.
 * `cfops` (opcional) sobrescreve o CFOP sugerido por linha (chave → CFOP).
 */
export async function montarEspelhoDevolucao(
  db: Db,
  devId: string | number,
  cfops?: Record<string, string>,
): Promise<EspelhoDevolucao> {
  const pend: string[] = [];
  const dev = (await db.query(
    `SELECT d.dev_id::text AS dev_id, d.dev_status, d.dev_cancel, d.dev_coddoc, d.dev_coddest, d.dev_obs,
            e.chave, e.nroform, e.serie, n.codnfe_ent, n.nnf, n.serie AS serie_nf, n.xml_completo
       FROM fat_devolucao d
       JOIN dbent e ON e.codent = d.dev_coddoc
       LEFT JOIN LATERAL (SELECT * FROM dbnfe_ent n WHERE right(n.chave, 44) = right(e.chave, 44)
                           ORDER BY n.codnfe_ent DESC LIMIT 1) n ON true
      WHERE d.dev_id = $1 AND d.dev_tipodoc = 'ENTRADA'`,
    [String(devId)],
  )).rows[0];
  if (!dev) throw new Error(`Devolução ${devId} não encontrada.`);

  const cli = (await db.query(
    `SELECT codcli, nome, cpfcgc, uf, iest, codmunicipio FROM dbclien WHERE codcli = $1`,
    [dev.dev_coddest],
  )).rows[0];
  if (!cli) pend.push('A devolução não tem cliente (destinatário). Gere o pré-pedido informando o cliente.');
  else if (!/^\d{7}$/.test(String(cli.codmunicipio ?? '').replace(/\D/g, '')) || !cli.uf) {
    pend.push(`O cliente ${cli.codcli} está sem UF ou código do município (IBGE). Complete o cadastro do cliente.`);
  }

  const emp = (await db.query(
    `SELECT cgc, uf FROM dadosempresa WHERE "certificadoKey" IS NOT NULL
      ORDER BY (regexp_replace(COALESCE(cgc,''),'\\D','','g') LIKE '04618302%') DESC, cgc LIMIT 1`,
  )).rows[0] ?? (await db.query(`SELECT cgc, uf FROM dadosempresa LIMIT 1`)).rows[0] ?? {};
  const cgcEmp = String(emp.cgc ?? '').replace(/\D/g, '');
  const ufEmp = String(emp.uf ?? 'AM').toUpperCase();
  const matriz = cgcEmp.charAt(11) === '1';

  const prePed = (await db.query(
    `SELECT v.codvenda, v.nrovenda FROM fat_devolucao_registro r
       JOIN dbvenda v ON v.codvenda = r.der_codigo
      WHERE r.der_dev_id = $1 AND r.der_documento = 'VENDA' AND COALESCE(v.cancel,'N') <> 'S'
      ORDER BY v.codvenda DESC LIMIT 1`,
    [String(devId)],
  )).rows[0];
  if (!prePed) pend.push('A devolução não tem pré-pedido ativo.');

  const chaveRef = String(dev.chave ?? '').replace(/\D/g, '').slice(-44);
  if (chaveRef.length !== 44) pend.push('A entrada não tem a chave da NF do fornecedor para referenciar.');

  const itens = (await db.query(
    `SELECT it.itd_id, it.itd_codprod AS codprod, it.itd_codreq AS codreq, it.itd_motivo AS motivo,
            it.itd_quant_devolvida::numeric AS qtd, it.itd_prunit,
            p.descr, p.ref, p.unimed, p.clasfiscal, p.cest
       FROM fat_it_devolucao it
       JOIN dbprod p ON p.codprod = it.itd_codprod
      WHERE it.itd_dev_id = $1
      ORDER BY it.itd_id`,
    [String(devId)],
  )).rows;

  const assoc = dev.codnfe_ent
    ? (await db.query(
        `SELECT produto_cod, nfe_item_id::int AS nitem, quantidade_associada::numeric AS qtd
           FROM nfe_item_associacao
          WHERE nfe_id = $1 AND status <> 'ASSOCIADO_TESTE'
          ORDER BY nfe_item_id`,
        [dev.codnfe_ent],
      )).rows
    : [];
  // Fonte dos impostos: o XML do fornecedor (entradas do web) ou, nas entradas migradas do
  // Oracle (sem XML; o Delphi gravou DBITENT.FIS_*), os impostos do item da entrada.
  const temXml = !!dev.xml_completo && String(dev.xml_completo).length > 100 && assoc.length > 0;
  const fisDelphi = !temXml && Number((await db.query(
    `SELECT count(*) AS n FROM dbitent WHERE codent = $1 AND fis_vprod IS NOT NULL`, [dev.dev_coddoc])).rows[0]?.n) > 0;

  const linhas: LinhaEspelho[] = [];
  if (fisDelphi) {
    linhas.push(...(await linhasDaEntradaDelphi(db, dev.dev_coddoc, itens, { matriz, coddest: dev.dev_coddest, cfops })));
    for (const it of itens) {
      if (!linhas.some((l) => l.codprod === it.codprod && (l.codreq ?? '') === (it.codreq ?? ''))) {
        pend.push(`Produto ${it.codprod}: não encontrado nos itens da entrada.`);
      }
    }
  } else {
    let dets = new Map<number, DetXml>();
    if (dev.xml_completo && String(dev.xml_completo).length > 100) {
      try {
        dets = await lerItensXmlNfe(String(dev.xml_completo));
      } catch {
        pend.push('Não foi possível ler o XML da NF do fornecedor.');
      }
    } else {
      pend.push('O XML da NF do fornecedor não está importado; os impostos não podem ser espelhados.');
    }
    linhas.push(...linhasDoXml(itens, assoc, dets, { matriz, cfops, pend }));
  }
  for (const l of linhas) {
    if (!l.ncm) pend.push(`Produto ${l.codprod}: sem NCM.`);
  }

  const totais = totalizarEspelho(linhas);
  const infCompl =
    `BASE ICMS-ST: R$ ${totais.baseSt.toFixed(2)} VALOR ICMS-ST: R$ ${totais.st.toFixed(2)} ` +
    `VALOR IPI DEVOL.: R$ ${totais.ipi.toFixed(2)}`;

  return {
    devId: dev.dev_id,
    status: dev.dev_cancel === 'S' ? 'C' : dev.dev_status,
    codent: dev.dev_coddoc,
    codnfeEnt: dev.codnfe_ent ?? null,
    nfFornecedor: String(dev.nnf ?? dev.nroform ?? '').replace(/^0+/, ''),
    serieFornecedor: String(dev.serie_nf ?? dev.serie ?? ''),
    chaveRef,
    codvenda: prePed?.codvenda ?? null,
    nrovenda: prePed?.nrovenda ?? null,
    cliente: {
      codcli: cli?.codcli ?? '',
      nome: cli?.nome ?? '',
      cpfcgc: String(cli?.cpfcgc ?? ''),
      uf: String(cli?.uf ?? '').toUpperCase(),
      iest: String(cli?.iest ?? ''),
      codmunicipio: String(cli?.codmunicipio ?? ''),
    },
    empresa: { cgc: cgcEmp, uf: ufEmp, matriz },
    interestadual: !!cli && String(cli.uf ?? '').toUpperCase() !== ufEmp,
    linhas,
    totais,
    infCompl,
    obs: String(dev.dev_obs ?? ''),
    pendencias: pend,
  };
}

/** Linhas a partir do XML do fornecedor (entradas do web). */
function linhasDoXml(
  itens: any[],
  assoc: any[],
  dets: Map<number, DetXml>,
  o: { matriz: boolean; cfops?: Record<string, string>; pend: string[] },
): LinhaEspelho[] {
  const { matriz, cfops, pend } = o;
  // quantidade da associação já consumida (mesmo produto em vários pedidos/itens da devolução)
  const usado = new Map<number, number>();
  const linhas: LinhaEspelho[] = [];
  for (const it of itens) {
    let falta = num(it.qtd);
    const linhasNf = assoc.filter((a: any) => a.produto_cod === it.codprod);
    if (!linhasNf.length) {
      pend.push(`Produto ${it.codprod}: não está associado a um item da NF do fornecedor.`);
      continue;
    }
    for (const a of linhasNf) {
      if (falta <= 0) break;
      const qtdAssoc = num(a.qtd);
      const disponivel = qtdAssoc - (usado.get(a.nitem) ?? 0);
      if (disponivel <= 0) continue;
      const q = Math.min(falta, disponivel);
      usado.set(a.nitem, (usado.get(a.nitem) ?? 0) + q);
      falta -= q;

      const d = dets.get(Number(a.nitem));
      if (!d) {
        pend.push(`Produto ${it.codprod}: item ${a.nitem} não encontrado no XML do fornecedor.`);
        continue;
      }
      const prop = qtdAssoc > 0 ? q / qtdAssoc : 0;
      const prunit = qtdAssoc > 0 ? Math.round((d.vProd / qtdAssoc) * 1e6) / 1e6 : num(it.itd_prunit);
      const totalproduto = r2(q * prunit);
      const cstIcms3 = `${d.orig || '0'}${String(d.cstIcms || '90').padStart(2, '0').slice(-2)}`;
      const baseIcms = r2(d.vBC * prop);
      const chave = `${it.codprod}|${a.nitem}`;
      const sugerido = cfopDevolucao(d.cfop, d.cstIcms);
      const cfop = cfops?.[chave] && cfopValidoDevolucao(cfops[chave]) ? cfops[chave] : sugerido;
      linhas.push({
        chave,
        codprod: it.codprod,
        descr: String(it.descr ?? '').trim(),
        ref: String(it.ref ?? '').trim(),
        unidade: String(it.unimed ?? d.uCom ?? 'UN').trim() || 'UN',
        codreq: it.codreq ?? null,
        motivo: it.motivo ?? null,
        nItemNf: Number(a.nitem),
        qtd: q,
        prunit,
        totalproduto,
        cfopFornecedor: d.cfop,
        cfop,
        ncm: (d.ncm || String(it.clasfiscal ?? '')).replace(/\D/g, ''),
        cest: (d.cest || String(it.cest ?? '')).replace(/\D/g, ''),
        csticms: cstIcms3,
        aliqIcms: r2(d.pICMS),
        baseIcms,
        valorIcms: r2((baseIcms * d.pICMS) / 100),
        icmsDeson: matriz ? r2(d.vICMSDeson * prop) : 0,
        motDesIcms: d.motDesICMS || (d.vICMSDeson > 0 ? '7' : ''),
        cstipi: d.cstIpi || '53',
        aliqIpi: r2(d.pIPI),
        baseIpi: r2(d.vBCIpi * prop),
        valorIpi: r2(d.vIPI * prop),
        cstpis: d.cstPis || '08',
        aliqPis: d.pPIS,
        basePis: r2(d.vBCPis * prop),
        valorPis: r2(d.vPIS * prop),
        cstcofins: d.cstCofins || '08',
        aliqCofins: d.pCOFINS,
        baseCofins: r2(d.vBCCofins * prop),
        valorCofins: r2(d.vCOFINS * prop),
        baseSt: r2(d.vBCST * prop),
        valorSt: r2(d.vICMSST * prop),
        outros: r2(d.vOutro * prop),
        desconto: r2(d.vDesc * prop),
      });
    }
    if (falta > 0.0001) {
      pend.push(`Produto ${it.codprod}: a NF do fornecedor não tem quantidade associada suficiente (faltam ${falta}).`);
    }
  }

  return linhas;
}

/** CFOP de entrada → o de saída equivalente (1→5, 2→6, 3→7), para sugerir o da devolução. */
function cfopSaidaEquivalente(cfopEntrada: string): string {
  const c = String(cfopEntrada ?? '').replace(/\D/g, '');
  const p = ({ '1': '5', '2': '6', '3': '7' } as Record<string, string>)[c.charAt(0)];
  return p ? `${p}${c.slice(1)}` : c;
}

/**
 * Linhas a partir do item da entrada (porte do ramo ENTRADA do GER_FAT_AUX_DEVOLUCAO): os
 * impostos gravados pelo Delphi (FIS_*, com os campos antigos como reserva), na proporção
 * devolvida / quantidade da nota. Usado nas entradas migradas do Oracle, que não têm o XML.
 */
async function linhasDaEntradaDelphi(
  db: Db,
  codent: string,
  itens: any[],
  o: { matriz: boolean; coddest: string; cfops?: Record<string, string> },
): Promise<LinhaEspelho[]> {
  const { rows } = await db.query(
    `SELECT ie.*, p.clasfiscal, p.strib, p.cest AS cest_prod, p.unimed
       FROM dbitent ie JOIN dbprod p ON p.codprod = ie.codprod
      WHERE ie.codent = $1`, [codent]);
  const porItem = new Map<string, any>(rows.map((r: any) => [`${r.codprod}|${r.codreq ?? ''}`, r]));
  const abs = (v: any) => Math.abs(num(v));
  const nvl = (...v: any[]) => v.find((x) => x != null && x !== '');
  const linhas: LinhaEspelho[] = [];
  let seq = 0;
  for (const it of itens) {
    const e = porItem.get(`${it.codprod}|${it.codreq ?? ''}`);
    if (!e) continue;
    seq += 1;
    const q = num(it.qtd);
    const original = num(nvl(e.quantnf, e.quant)) || q;
    const prop = original > 0 ? q / original : 0;
    const prunit = num(nvl(e.prunitnf, e.prunit, it.itd_prunit));
    const vprod = e.fis_vprod != null && r2(num(e.fis_vprod) * prop) !== 0 ? abs(e.fis_vprod) * prop : prunit * q;
    const totalproduto = r2(vprod);
    const aliqIcms = abs(nvl(e.fis_aliqicms, e.icms));
    const baseIcms = r2(abs(nvl(e.fis_baseicms, e.base_icms)) * prop);
    // CST do IPI: o da entrada (00–05, 49) vira o de saída (+50), como o Delphi
    const ipiEnt = String(nvl(e.fis_ipicst, e.cstipi) ?? '').padStart(2, '0');
    const cstipi = /^(0[0-5]|49)$/.test(ipiEnt) ? String(Number(ipiEnt) + 50) : ipiEnt || '53';
    const cstIcms = String(nvl(e.fis_icmscst, e.csticms, e.strib) ?? '090');
    const csticms = cstIcms.length >= 3 ? cstIcms.slice(-3) : `0${cstIcms.padStart(2, '0')}`;
    const ncm = String(nvl(e.ncm, e.clasfiscal) ?? '').replace(/\D/g, '');
    const cest = String((e.ncm ? e.fis_cest : e.cest_prod) ?? '').replace(/\D/g, '');
    const cfopFornecedor = cfopSaidaEquivalente(String(e.cfop ?? ''));
    const chave = `${it.codprod}|${it.codreq ?? ''}`;
    const sugerido = cfopDevolucao(cfopFornecedor, csticms);
    const cfop = o.cfops?.[chave] && cfopValidoDevolucao(o.cfops[chave]) ? o.cfops[chave] : sugerido;
    const deson = o.matriz ? r2(num(e.fis_icmsdeson) * prop) : 0;
    // PIS/COFINS não tributados (CST 04–09: grupo NT) não levam base nem valor
    const cstpis = String(nvl(e.fis_piscst, e.cstpis) ?? '08').padStart(2, '0');
    const cstcofins = String(nvl(e.fis_cofinscst, e.cstcofins) ?? '08').padStart(2, '0');
    const pisTrib = !/^0[4-9]$/.test(cstpis);
    const cofTrib = !/^0[4-9]$/.test(cstcofins);
    linhas.push({
      chave,
      codprod: it.codprod,
      descr: String(it.descr ?? '').trim(),
      ref: String(it.ref ?? '').trim(),
      unidade: String(e.unimed ?? it.unimed ?? 'UN').trim() || 'UN',
      codreq: it.codreq ?? null,
      motivo: it.motivo ?? null,
      nItemNf: num(e.fis_nroitemnfe) || seq,
      qtd: q,
      prunit,
      totalproduto,
      cfopFornecedor,
      cfop,
      ncm,
      cest,
      csticms,
      aliqIcms: r2(aliqIcms),
      baseIcms,
      valorIcms: r2((baseIcms * aliqIcms) / 100),
      icmsDeson: deson,
      motDesIcms: deson > 0 ? '7' : '',
      cstipi,
      aliqIpi: r2(abs(nvl(e.fis_aliqipi, e.ipi))),
      baseIpi: r2(abs(nvl(e.fis_baseipi, e.base_ipi)) * prop),
      valorIpi: r2(abs(nvl(e.fis_ipi, e.valor_ipi)) * prop),
      cstpis,
      aliqPis: pisTrib ? r2(num(e.aliquota_pis)) : 0,
      basePis: pisTrib ? r2(abs(e.basepis) * prop) : 0,
      valorPis: pisTrib ? r2(abs(e.pis) * prop) : 0,
      cstcofins,
      aliqCofins: cofTrib ? num(e.aliquota_cofins) : 0,
      baseCofins: cofTrib ? r2(abs(e.basecofins) * prop) : 0,
      valorCofins: cofTrib ? r2(abs(e.cofins) * prop) : 0,
      baseSt: r2(abs(nvl(e.fis_baseicmsst, e.base_icms_subst)) * prop),
      valorSt: r2(abs(nvl(e.fis_icmsst, e.valor_icms_subst)) * prop),
      outros: r2(abs(e.fis_outro) * prop),
      // o Delphi zera o desconto quando a matriz devolve para o cliente 19395
      desconto: o.matriz && o.coddest === '19395' ? 0 : r2(abs(e.fis_desconto) * prop),
    });
  }
  return linhas;
}

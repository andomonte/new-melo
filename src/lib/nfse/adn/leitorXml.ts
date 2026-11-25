/**
 * Leitura do XML da NFS-e nacional (leiaute SPED "http://www.sped.fazenda.gov.br/nfse", v1.0x)
 * e dos eventos. Conferido com notas reais baixadas do ADN em 25/11/2026.
 *
 *   NFSe/infNFSe: nNFSe, dhProc, cStat, emit, valores (vISSQN, pAliqAplic, vTotalRet, vLiq)
 *     DPS/infDPS: dhEmi, dCompet, prest, toma, interm, serv/cServ (cTribNac, xDescServ),
 *                 valores: vServPrest/vServ, vDescCondIncond (vDescIncond, vDescCond), vDedRed/vDR,
 *                          trib/tribMun (pAliq, tpRetISSQN 1=não retido 2=retido tomador 3=retido intermediário),
 *                          trib/tribFed (piscofins: vPis, vCofins, tpRetPisCofins; vRetCP, vRetIRRF, vRetCSLL)
 *   evento/infEvento/pedRegEvento/infPedReg: chNFSe, e101101 (cancelamento) | e105102 (substituição) | ...
 */
import { parseStringPromise, processors } from 'xml2js';

const so = (v: any) => String(v ?? '').replace(/\D/g, '');
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : Math.round(n * 100) / 100; };
const txt = (v: any) => (v == null ? null : (typeof v === 'object' ? (v._ ?? null) : String(v)).trim() || null);
const caminho = (o: any, ...ks: string[]) => ks.reduce((a, k) => (a == null ? undefined : a[k]), o);

async function parse(xml: string) {
  return parseStringPromise(xml, {
    explicitArray: false, ignoreAttrs: false, mergeAttrs: true,
    tagNameProcessors: [processors.stripPrefix],
  });
}

export interface NotaNacional {
  tipo: 'NFSE';
  chave: string | null;
  numero: string | null;
  situacaoCodigo: string | null;       // cStat (100 = autorizada)
  dhProc: string | null;
  dtEmissao: string | null;            // yyyy-mm-dd
  competencia: string | null;          // MM/AAAA
  prestador: { doc: string | null; nome: string | null };
  tomador: { doc: string | null; nome: string | null };
  intermediario: { doc: string | null };
  codServico: string | null;           // cTribNac (6 dígitos)
  codServicoMun: string | null;
  descricao: string | null;
  valores: {
    servico: number; descontoIncond: number; descontoCond: number; deducoes: number;
    issAliquota: number; issValor: number; issRetido: boolean;
    pis: number; cofins: number; pisCofinsRetido: boolean; inss: number; ir: number; csll: number;
    totalRetido: number; liquido: number;
  };
}

export interface EventoNacional {
  tipo: 'EVENTO';
  chaveReferida: string | null;        // chNFSe
  codigoEvento: string | null;         // ex.: 101101
  descricao: string | null;
  motivo: string | null;
  dhEvento: string | null;
}

/** Converte dCompet (yyyy-mm-dd) em MM/AAAA. */
const competencia = (d: string | null) => (d && /^\d{4}-\d{2}/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : null);

export async function lerDocumentoNacional(xml: string): Promise<NotaNacional | EventoNacional | null> {
  if (!xml) return null;
  const j: any = await parse(xml);
  if (j.NFSe) {
    const inf = j.NFSe.infNFSe || {};
    const dps = caminho(inf, 'DPS', 'infDPS') || {};
    const v = dps.valores || {};
    const tribMun = caminho(v, 'trib', 'tribMun') || {};
    const tribFed = caminho(v, 'trib', 'tribFed') || {};
    const pc = tribFed.piscofins || {};
    const vNF = inf.valores || {};
    const doc = (o: any) => txt(o?.CNPJ) || txt(o?.CPF) || txt(o?.NIF) || null;
    const id = txt(inf.Id) || '';
    const pis = num(pc.vPis), cofins = num(pc.vCofins);
    const pisCofinsRetido = String(txt(pc.tpRetPisCofins) || '') === '1';
    const issRetido = ['2', '3'].includes(String(txt(tribMun.tpRetISSQN) || ''));
    const servico = num(caminho(v, 'vServPrest', 'vServ'));
    const issAliquota = num(vNF.pAliqAplic) || num(tribMun.pAliq);
    const issValor = num(vNF.vISSQN);
    return {
      tipo: 'NFSE',
      chave: id.replace(/^NFS/, '') || null,
      numero: txt(inf.nNFSe),
      situacaoCodigo: txt(inf.cStat),
      dhProc: txt(inf.dhProc),
      dtEmissao: (txt(dps.dhEmi) || txt(inf.dhProc) || '').slice(0, 10) || null,
      competencia: competencia(txt(dps.dCompet)),
      prestador: { doc: doc(dps.prest) || doc(inf.emit), nome: txt(dps.prest?.xNome) || txt(inf.emit?.xNome) },
      tomador: { doc: doc(dps.toma), nome: txt(dps.toma?.xNome) },
      intermediario: { doc: doc(dps.interm) },
      codServico: txt(caminho(dps, 'serv', 'cServ', 'cTribNac')),
      codServicoMun: txt(caminho(dps, 'serv', 'cServ', 'cTribMun')),
      descricao: txt(caminho(dps, 'serv', 'cServ', 'xDescServ')),
      valores: {
        servico,
        descontoIncond: num(caminho(v, 'vDescCondIncond', 'vDescIncond')),
        descontoCond: num(caminho(v, 'vDescCondIncond', 'vDescCond')),
        deducoes: num(caminho(v, 'vDedRed', 'vDR')),
        issAliquota, issValor, issRetido,
        pis, cofins, pisCofinsRetido,
        inss: num(tribFed.vRetCP), ir: num(tribFed.vRetIRRF), csll: num(tribFed.vRetCSLL),
        totalRetido: num(vNF.vTotalRet),
        liquido: num(vNF.vLiq) || servico,
      },
    };
  }
  if (j.evento) {
    const inf = j.evento.infEvento || {};
    const ped = caminho(inf, 'pedRegEvento', 'infPedReg') || {};
    const chaveEvento = Object.keys(ped).find((k) => /^e\d{6}$/.test(k));
    const det = chaveEvento ? ped[chaveEvento] || {} : {};
    return {
      tipo: 'EVENTO',
      chaveReferida: txt(ped.chNFSe),
      codigoEvento: chaveEvento ? chaveEvento.slice(1) : null,
      descricao: txt(det.xDesc),
      motivo: txt(det.xMotivo),
      dhEvento: txt(ped.dhEvento) || txt(inf.dhProc),
    };
  }
  return null;
}

/** Papel do CNPJ consultado na nota (compara pela raiz de 8 dígitos: matriz e filiais). */
export function papelNaNota(n: NotaNacional, cnpjConsulta: string): 'PRESTADOR' | 'TOMADOR' | 'INTERMEDIARIO' | 'OUTRO' {
  const raiz = so(cnpjConsulta).slice(0, 8);
  const igual = (d: string | null) => !!d && so(d).length === 14 && so(d).slice(0, 8) === raiz;
  if (igual(n.prestador.doc)) return 'PRESTADOR';
  if (igual(n.tomador.doc)) return 'TOMADOR';
  if (igual(n.intermediario.doc)) return 'INTERMEDIARIO';
  return 'OUTRO';
}

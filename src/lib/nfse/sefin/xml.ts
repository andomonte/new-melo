/**
 * Montagem do XML da DPS e do Pedido de Registro de Evento (cancelamento) do Sistema Nacional NFS-e.
 * Leiaute v1.01 — há duas variantes vivas (conferidas com os XSD oficiais em 25/11/2026):
 *   PRODUCAO (esquema 09/02/2026): cServ = cTribNac, cTribMun?, xDescServ, cNBS?; deduções em vDedRed
 *   RESTRITA (esquema 20/10/2026): + finNFSe (obrigatório, "0") depois de tpEmit;
 *                                  cServ = cTribNac, cTribMun?, cNBS?, cIntContrib?, xDescServ
 * Os XML saem SEM assinatura (ver assinatura.ts). Só servidor.
 */
export type AmbienteSefin = 'PRODUCAO' | 'RESTRITA';

const esc = (v: any) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // o leiaute não aceita quebras/tabs nem espaços duplos nas strings
  .replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
const dec = (v: number) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
const so = (v: any) => String(v ?? '').replace(/\D/g, '');
const tag = (nome: string, v: any) => (v === undefined || v === null || v === '' ? '' : `<${nome}>${v}</${nome}>`);

export interface PessoaDps {
  doc: string;                 // CNPJ (14) ou CPF (11)
  im?: string | null;
  nome?: string | null;
  endereco?: { cMun: string; cep: string; logradouro: string; numero: string; complemento?: string | null; bairro: string } | null;
  fone?: string | null;
  email?: string | null;
}

export interface DadosDps {
  ambiente: AmbienteSefin;
  cMunEmissor: string;         // IBGE (7) do município do prestador
  serie: string;               // até 5 dígitos
  numero: number;              // nDPS (até 15 dígitos)
  dhEmi: string;               // AAAA-MM-DDThh:mm:ss-03:00 (fuso de Brasília)
  dCompet: string;             // AAAA-MM-DD
  prestador: PessoaDps & { opSimpNac: '1' | '2' | '3'; regApTribSN?: '1' | '2' | '3' | null; regEspTrib: string };
  tomador: PessoaDps;
  servico: { cLocPrestacao: string; cTribNac: string; cTribMun?: string | null; descricao: string; cNBS?: string | null };
  valores: {
    servico: number; descontoIncond?: number;
    issRetido: boolean; issAliquota?: number | null;
    pis?: number; cofins?: number; inss?: number; ir?: number; csll?: number;
    /** Totais aproximados dos tributos (Lei 12.741) em %; sem ele vai indTotTrib = 0 (não informado). */
    totTribPerc?: { fed: number; est: number; mun: number } | null;
  };
  verAplic?: string;
}

/** Id da DPS: "DPS" + cMun(7) + tipo inscrição (1=CPF, 2=CNPJ) + inscrição(14) + série(5) + nº(15). */
export function idDps(cMun: string, docPrestador: string, serie: string, numero: number) {
  const d = so(docPrestador);
  const tipo = d.length === 11 ? '1' : '2';
  return `DPS${so(cMun).padStart(7, '0')}${tipo}${d.padStart(14, '0')}${so(serie).padStart(5, '0')}${String(numero).padStart(15, '0')}`;
}

const pessoa = (p: PessoaDps, comNome: boolean) => {
  const d = so(p.doc);
  const e = p.endereco;
  return (d.length === 11 ? tag('CPF', d) : tag('CNPJ', d))
    + tag('IM', p.im ? esc(String(p.im).trim()) : '')
    + (comNome ? tag('xNome', p.nome ? esc(p.nome).slice(0, 300) : '') : '')
    + (e ? `<end><endNac>${tag('cMun', so(e.cMun))}${tag('CEP', so(e.cep))}</endNac>${tag('xLgr', esc(e.logradouro).slice(0, 255))}${tag('nro', esc(e.numero || 'S/N').slice(0, 60))}${tag('xCpl', e.complemento ? esc(e.complemento).slice(0, 156) : '')}${tag('xBairro', esc(e.bairro).slice(0, 60))}</end>` : '')
    + tag('fone', so(p.fone).slice(0, 20) || '')
    + tag('email', p.email ? esc(p.email).slice(0, 80) : '');
};

export function montarDps(d: DadosDps): { id: string; xml: string } {
  const id = idDps(d.cMunEmissor, d.prestador.doc, d.serie, d.numero);
  const v = d.valores;
  const restrita = d.ambiente === 'RESTRITA';
  const fed = [v.pis, v.cofins, v.inss, v.ir, v.csll].some((x) => (Number(x) || 0) > 0);
  const cNbs = d.servico.cNBS ? tag('cNBS', so(d.servico.cNBS)) : '';
  const desc = tag('xDescServ', esc(d.servico.descricao).slice(0, 2000));
  const xml =
    `<DPS versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="${id}">`
    + tag('tpAmb', restrita ? '2' : '1')
    + tag('dhEmi', d.dhEmi)
    + tag('verAplic', esc(d.verAplic || 'SysMelo_1.0'))
    + tag('serie', so(d.serie))
    + tag('nDPS', String(d.numero))
    + tag('dCompet', d.dCompet)
    + tag('tpEmit', '1')
    + (restrita ? tag('finNFSe', '0') : '')
    + tag('cLocEmi', so(d.cMunEmissor))
    + `<prest>${pessoa(d.prestador, false)}<regTrib>${tag('opSimpNac', d.prestador.opSimpNac)}${d.prestador.opSimpNac === '3' ? tag('regApTribSN', d.prestador.regApTribSN || '1') : ''}${tag('regEspTrib', d.prestador.regEspTrib || '0')}</regTrib></prest>`
    + `<toma>${pessoa(d.tomador, true)}</toma>`
    + `<serv><locPrest>${tag('cLocPrestacao', so(d.servico.cLocPrestacao))}</locPrest><cServ>${tag('cTribNac', so(d.servico.cTribNac).padStart(6, '0'))}${tag('cTribMun', d.servico.cTribMun ? so(d.servico.cTribMun).padStart(3, '0') : '')}${restrita ? cNbs + desc : desc + cNbs}</cServ></serv>`
    + `<valores><vServPrest>${tag('vServ', dec(v.servico))}</vServPrest>`
    + ((Number(v.descontoIncond) || 0) > 0 ? `<vDescCondIncond>${tag('vDescIncond', dec(v.descontoIncond!))}</vDescCondIncond>` : '')
    + `<trib><tribMun>${tag('tribISSQN', '1')}${tag('tpRetISSQN', v.issRetido ? '2' : '1')}${v.issAliquota ? tag('pAliq', dec(v.issAliquota)) : ''}</tribMun>`
    + (fed ? `<tribFed>${(Number(v.pis) || 0) + (Number(v.cofins) || 0) > 0
        ? `<piscofins>${tag('CST', '01')}${tag('vPis', dec(v.pis || 0))}${tag('vCofins', dec(v.cofins || 0))}${tag('tpRetPisCofins', '1')}</piscofins>` : ''}`
        + ((Number(v.inss) || 0) > 0 ? tag('vRetCP', dec(v.inss!)) : '')
        + ((Number(v.ir) || 0) > 0 ? tag('vRetIRRF', dec(v.ir!)) : '')
        + ((Number(v.csll) || 0) > 0 ? tag('vRetCSLL', dec(v.csll!)) : '')
        + `</tribFed>` : '')
    + `<totTrib>${v.totTribPerc
        ? `<pTotTrib>${tag('pTotTribFed', dec(v.totTribPerc.fed))}${tag('pTotTribEst', dec(v.totTribPerc.est))}${tag('pTotTribMun', dec(v.totTribPerc.mun))}</pTotTrib>`
        : tag('indTotTrib', '0')}</totTrib></trib></valores>`
    + `</infDPS></DPS>`;
  return { id, xml };
}

/** Pedido de cancelamento (evento 101101). cMotivo: 1 = erro na emissão, 2 = serviço não prestado, 9 = outros. */
export function montarPedidoCancelamento(p: {
  ambiente: AmbienteSefin; chave: string; cnpjAutor: string; dhEvento: string;
  cMotivo: '1' | '2' | '9'; motivo: string; verAplic?: string;
}) {
  const chave = so(p.chave);
  const id = `PRE${chave}101101`;
  const xml =
    `<pedRegEvento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infPedReg Id="${id}">`
    + tag('tpAmb', p.ambiente === 'RESTRITA' ? '2' : '1')
    + tag('verAplic', esc(p.verAplic || 'SysMelo_1.0'))
    + tag('dhEvento', p.dhEvento)
    + tag('CNPJAutor', so(p.cnpjAutor))
    + tag('chNFSe', chave)
    + `<e101101>${tag('xDesc', 'Cancelamento de NFS-e')}${tag('cMotivo', p.cMotivo)}${tag('xMotivo', esc(p.motivo).slice(0, 255))}</e101101>`
    + `</infPedReg></pedRegEvento>`;
  return { id, xml };
}

/** Data/hora atual no fuso de Brasília, no formato do leiaute (AAAA-MM-DDThh:mm:ss-03:00). */
export function agoraBrasilia(): string {
  const d = new Date(Date.now() - 3 * 3600e3);
  return `${d.toISOString().slice(0, 19)}-03:00`;
}

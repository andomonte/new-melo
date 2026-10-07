/**
 * Builder ISOLADO da NF-e de nacionalização (nota de entrada de importação).
 *
 * Plano B (zero risco): NÃO altera `gerarXMLNFe` (emissão de venda). Reusa só os
 * helpers puros de grupos de imposto exportados de `gerarXml.ts`. A venda sai
 * byte-idêntica — este arquivo é um caminho paralelo.
 *
 * Suporta os dois modos (B10):
 *   - POR_DI (padrão = Delphi): 1 NF-e por DI; cExportador/adição por item.
 *   - POR_EXPORTADOR: 1 NF-e por exportador (agrupa itens pelo cExportador da adição).
 *
 * Especificidades da importação (leiaute NF-e modelo 55, confirmado no parser
 * de entrada UniDtMd.pas): tpNF=0, idDest=3, destinatário EXTERIOR (idEstrangeiro,
 * UF=EX, cMun=9999999), CFOP série 3, grupo DI + adi por item, grupo II por item,
 * origem ICMS=1. Spec: docs/nota-nacionalizacao-web.md.
 */

import { create } from 'xmlbuilder2';
import {
  calcularDV,
  formatarDataSefaz,
  montarGrupoICMS,
  montarGrupoIPI,
  montarGrupoPIS,
  montarGrupoCOFINS,
  montarGrupoIBSCBS,
} from './gerarXml';

export type ModoEmissaoImportacao = 'POR_DI' | 'POR_EXPORTADOR';

/** Dados da adição do item (grupo DI/adi + grupo II). */
export interface AdicaoImportacao {
  numero_adicao?: number | string;
  seq_adicao?: number | string; // nSeqAdic
  cod_fabricante?: string; // cFabricante
  cod_exportador?: string; // cExportador
  exportador_nome?: string;
  exportador_pais?: string; // cPais
  exportador_id_estr?: string; // idEstrangeiro
  bc_ii?: number; // II: vBC
  despesa_aduaneira?: number; // II: vDespAdu
  valor_ii?: number; // II: vII
  valor_iof?: number; // II: vIOF
  vl_desc_di?: number; // adi: vDescDI
  n_draw?: string; // adi: nDraw
}

export interface ItemImportacaoNfe {
  codprod: string;
  descricao: string;
  ref?: string;        // dbprod.ref → xProd = "ref - descr"
  cest?: string;       // dbprod.cest (quando houver)
  cEAN?: string;       // GTIN; default SEM GTIN
  vOutro?: number;     // rateio flat de outros_valores (vOutro por item)
  ncm?: string;
  cfop?: string; // série 3; default 3102
  unidade?: string;
  qtd: number;
  vUnit: number;
  adicao?: AdicaoImportacao;
  // grupos de imposto já calculados (mesmo formato dos helpers de venda)
  icms?: any; // origem será forçada p/ '1'
  ipi?: any;
  pis?: any;
  cofins?: any;
  ibscbs?: any;
}

/** Cabeçalho da DI (grupo DI por-DI, modo POR_DI). */
export interface DiHeader {
  nro_di: string;
  data_di?: string | Date;
  local_desembaraco?: string;
  uf_desembaraco?: string; // default AM
  data_desembaraco?: string | Date;
  via_transporte?: number | string; // tpViaTransp
  forma_importacao?: number | string; // tpIntermedio
  valor_afrmm?: number; // vAFRMM (só marítimo)
}

export interface EmitenteImportacao {
  cnpj: string;
  ie?: string;
  nome?: string;
  fantasia?: string;
  ender?: string;
  numero?: string;
  bairro?: string;
  cMun?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  fone?: string;
  crt?: string;
}

export interface DadosNacionalizacao {
  modo?: ModoEmissaoImportacao;
  ambiente?: number | string; // 1=prod, 2=homolog (default)
  serie?: string;
  numeroNF?: string; // nNF; pode ser calculado pelo chamador
  naturezaOperacao?: string;
  cfopPadrao?: string; // default 3102
  emitente: EmitenteImportacao;
  di: DiHeader;
  itens: ItemImportacaoNfe[];
  /** Exportador destinatário no POR_DI (quando múltiplos, o principal/parametrizável). */
  destExterior?: {
    idEstrangeiro?: string;
    nome?: string;
    xLgr?: string;    // endereço real do exportador (dbclien)
    nro?: string;
    xBairro?: string;
    cep?: string;     // default 99999999
    cPais?: string;
    xPais?: string;
  };
  /** Informações complementares (infAdic/infCpl) — lista de fornecedores/faturas da DI. */
  infCpl?: string;
  /** Responsável técnico (infRespTec). Default MELO. */
  respTec?: { cnpj?: string; contato?: string; email?: string; fone?: string };
}

export interface NotaNacionalizacaoGerada {
  modo: ModoEmissaoImportacao;
  cod_exportador?: string;
  seq_nota: number;
  chave: string;
  xml: string;
  totais: {
    vProd: number;
    vII: number;
    vIPI: number;
    vPIS: number;
    vCOFINS: number;
    vICMS: number;
    vNF: number;
  };
}

const LIMITE_ITENS_NFE = 990;

/** Grupo II (Imposto de Importação) por item. */
function montarGrupoII(adi?: AdicaoImportacao): Record<string, string> {
  return {
    vBC: Number(adi?.bc_ii ?? 0).toFixed(2),
    vDespAdu: Number(adi?.despesa_aduaneira ?? 0).toFixed(2),
    vII: Number(adi?.valor_ii ?? 0).toFixed(2),
    vIOF: Number(adi?.valor_iof ?? 0).toFixed(2),
  };
}

function soData(data?: string | Date): string {
  if (!data) return '';
  const d = typeof data === 'string' ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return String(data).slice(0, 10);
  return d.toISOString().slice(0, 10); // AAAA-MM-DD
}

/** Monta o grupo <DI> (com <adi>) de um item. */
function montarDI(di: DiHeader, adi?: AdicaoImportacao): Record<string, any> {
  const grupo: Record<string, any> = {
    nDI: di.nro_di,
    dDI: soData(di.data_di),
    xLocDesemb: di.local_desembaraco ?? '',
    UFDesemb: di.uf_desembaraco || 'AM',
    dDesemb: soData(di.data_desembaraco),
    tpViaTransp: String(di.via_transporte ?? '1'),
  };
  // vAFRMM só quando via marítima (tpViaTransp = 1) e valor > 0
  if (String(di.via_transporte ?? '') === '1' && Number(di.valor_afrmm ?? 0) > 0) {
    grupo.vAFRMM = Number(di.valor_afrmm).toFixed(2);
  }
  grupo.tpIntermedio = String(di.forma_importacao ?? '1');
  if (adi?.cod_exportador) grupo.cExportador = adi.cod_exportador;

  const adiNode: Record<string, any> = {
    nAdicao: String(adi?.numero_adicao ?? '1'),
    nSeqAdic: String(adi?.seq_adicao ?? '1'),
    cFabricante: adi?.cod_fabricante || adi?.cod_exportador || '',
  };
  if (Number(adi?.vl_desc_di ?? 0) > 0) adiNode.vDescDI = Number(adi?.vl_desc_di).toFixed(2);
  if (adi?.n_draw) adiNode.nDraw = adi.n_draw;
  grupo.adi = adiNode;

  return grupo;
}

/** Gera a chave de acesso (44) de uma NF-e de importação. */
function gerarChaveImportacao(
  cUF: string,
  aamm: string,
  cnpj: string,
  mod: string,
  serieChave: string,
  numeroNF: string,
  tpEmis: string,
): { chave: string; cNF: string } {
  const nNFChave = ('000000000' + numeroNF).slice(-9);
  const parte1 = String(parseInt(numeroNF, 10) || 1).padStart(4, '0').slice(-4);
  const parte2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const cNF = parte1 + parte2;
  const chaveSemDV = `${cUF}${aamm}${cnpj}${mod}${serieChave}${nNFChave}${tpEmis}${cNF}`;
  const cDV = calcularDV(chaveSemDV);
  return { chave: `${chaveSemDV}${cDV}`, cNF };
}

function serieParaChave(serie: string): string {
  if (/^\d+$/.test(serie)) return ('000' + serie).slice(-3);
  let codigo = 0;
  for (let i = 0; i < serie.length; i++) codigo += serie.charCodeAt(i);
  return String(codigo % 1000).padStart(3, '0');
}

/** Monta UMA NF-e de nacionalização a partir de um lote de itens já definido. */
function montarUmaNota(
  dados: DadosNacionalizacao,
  itens: ItemImportacaoNfe[],
  modo: ModoEmissaoImportacao,
  codExportador: string | undefined,
  seqNota: number,
  numeroNF: string,
): NotaNacionalizacaoGerada {
  const emit = dados.emitente;
  const cUF = '13'; // AM
  const mod = '55';
  const tpEmis = '1';
  const tpAmb = String(dados.ambiente ?? '2');
  const serieNF = dados.serie || '1';
  const cnpj = (emit.cnpj || '').replace(/\D/g, '');
  const dhEmi = new Date();
  const aamm = dhEmi.getFullYear().toString().substring(2) + ('0' + (dhEmi.getMonth() + 1)).slice(-2);
  const { chave, cNF } = gerarChaveImportacao(cUF, aamm, cnpj, mod, serieParaChave(serieNF), numeroNF, tpEmis);

  // Destinatário EXTERIOR
  const dest = dados.destExterior ?? {};
  const destBlock: any = {
    idEstrangeiro: dest.idEstrangeiro || '',
    xNome:
      tpAmb === '2'
        ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : dest.nome || codExportador || 'EXPORTADOR EXTERIOR',
    enderDest: {
      xLgr: dest.xLgr || 'EXTERIOR',
      nro: dest.nro || 'S/N',
      xBairro: dest.xBairro || 'EXTERIOR',
      cMun: '9999999',
      xMun: 'EXTERIOR',
      UF: 'EX',
      CEP: (dest.cep || '99999999').replace(/\D/g, ''),
      cPais: dest.cPais || '9999',
      xPais: dest.xPais || 'EXTERIOR',
    },
    indIEDest: '9',
  };

  // Totais acumulados a partir do que cada item realmente grava
  const tot = {
    vProd: 0, vII: 0, vIPI: 0, vPIS: 0, vCOFINS: 0, vBC: 0, vICMS: 0, vOutro: 0,
    vBCIBS: 0, vIBSUF: 0, vIBSMun: 0, vIBS: 0, vCBS: 0,
  };

  const det = itens.map((item, index) => {
    const qtde = Number(item.qtd ?? 1);
    const preco = Number(item.vUnit ?? 0);
    const vProd = Math.round(preco * qtde * 100) / 100;
    // cProd zero-pad 14; cEAN = GTIN válido ou SEM GTIN; xProd = "ref - descr"
    const cProd = ('00000000000000' + String(item.codprod ?? '').replace(/\D/g, '')).slice(-14);
    const ean = String(item.cEAN ?? '').replace(/[^0-9A-Za-z]/g, '');
    const cEAN = /^\d{8,14}$/.test(ean) ? ean : 'SEM GTIN';
    const xProd = (item.ref ? `${item.ref} - ${item.descricao ?? ''}` : (item.descricao ?? '')).trim() || `Produto ${index + 1}`;
    const vOutroItem = Number(item.vOutro ?? 0);
    const icms = { ...(item.icms ?? {}), origem: '1' }; // estrangeira — importação direta
    const grupoICMS: any = montarGrupoICMS(icms, vProd.toFixed(2));
    const subICMS: any = Object.values(grupoICMS)[0] || {};

    const ii = montarGrupoII(item.adicao);
    tot.vProd += vProd;
    tot.vOutro += vOutroItem;
    tot.vBCIBS += Number(item.ibscbs?.vBC ?? vProd);
    tot.vIBSUF += Number(item.ibscbs?.vIBSUF ?? 0);
    tot.vIBSMun += Number(item.ibscbs?.vIBSMun ?? 0);
    tot.vIBS += Number(item.ibscbs?.vIBS ?? 0);
    tot.vCBS += Number(item.ibscbs?.vCBS ?? 0);
    tot.vII += Number(ii.vII);
    tot.vIPI += Number(item.ipi?.vIPI ?? 0);
    tot.vPIS += Number(item.pis?.vPIS ?? 0);
    tot.vCOFINS += Number(item.cofins?.vCOFINS ?? 0);
    tot.vBC += subICMS.vBC != null ? Number(subICMS.vBC) : 0;
    tot.vICMS += subICMS.vICMS != null ? Number(subICMS.vICMS) : 0;

    return {
      '@nItem': `${index + 1}`,
      prod: {
        cProd,
        cEAN,
        xProd,
        NCM: (item.ncm ?? '').replace(/\D/g, '') || '00000000',
        ...(item.cest ? { CEST: String(item.cest).replace(/\D/g, '') } : {}),
        CFOP: item.cfop ?? dados.cfopPadrao ?? '3102',
        uCom: item.unidade ?? 'UN',
        qCom: qtde.toFixed(4),
        vUnCom: preco.toFixed(4),
        vProd: vProd.toFixed(2),
        cEANTrib: cEAN,
        uTrib: item.unidade ?? 'UN',
        qTrib: qtde.toFixed(4),
        vUnTrib: preco.toFixed(4),
        ...(vOutroItem > 0 ? { vOutro: vOutroItem.toFixed(2) } : {}),
        indTot: '1',
        DI: montarDI(dados.di, item.adicao),
      },
      // Ordem do leiaute NF-e dentro de <imposto>: ICMS → IPI → II → PIS → COFINS → IBSCBS.
      imposto: {
        ICMS: grupoICMS,
        IPI: montarGrupoIPI(item.ipi, vProd.toFixed(2)),
        II: ii,
        PIS: montarGrupoPIS(item.pis, vProd.toFixed(2)),
        COFINS: montarGrupoCOFINS(item.cofins, vProd.toFixed(2)),
        IBSCBS: montarGrupoIBSCBS(item.ibscbs, vProd.toFixed(2)),
      },
    };
  });

  // Gabarito: vNF = vProd + vOutro (+ vII/vIPI, zerados na ZFM). IBSCBSTot/vNFTot ficam no P2.
  const vNF = tot.vProd + tot.vII + tot.vIPI + tot.vOutro;

  const xmlObj = {
    NFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe: {
        '@Id': `NFe${chave}`,
        '@versao': '4.00',
        ide: {
          cUF,
          cNF,
          natOp: String(dados.naturezaOperacao || 'COMPRA PARA COMERCIALIZACAO'),
          mod,
          serie: serieNF,
          nNF: numeroNF,
          dhEmi: formatarDataSefaz(dhEmi),
          tpNF: '0', // entrada
          idDest: '3', // operação com exterior
          cMunFG: '1302603',
          tpImp: '2', // DANFE paisagem (gabarito Delphi)
          tpEmis,
          cDV: chave.slice(-1),
          tpAmb,
          finNFe: '1',
          indFinal: '0',
          indPres: '1', // gabarito Delphi
          procEmi: '0',
          verProc: 'MELOSYS NFe 4.00',
        },
        emit: {
          CNPJ: cnpj,
          xNome: emit.nome || 'EMITENTE',
          xFant: emit.fantasia || emit.nome || 'EMITENTE',
          enderEmit: {
            xLgr: emit.ender ?? '',
            nro: emit.numero ?? 'S/N',
            xBairro: emit.bairro ?? '',
            cMun: emit.cMun || '1302603',
            xMun: emit.cidade || 'MANAUS',
            UF: emit.uf || 'AM',
            CEP: (emit.cep ?? '').replace(/\D/g, ''),
            cPais: '1058',
            xPais: 'BRASIL',
            ...(emit.fone ? { fone: emit.fone.replace(/\D/g, '') } : {}),
          },
          IE: (emit.ie ?? '').replace(/\D/g, ''),
          CRT: emit.crt || '3',
        },
        dest: destBlock,
        det,
        total: {
          ICMSTot: {
            vBC: tot.vBC.toFixed(2),
            vICMS: tot.vICMS.toFixed(2),
            vICMSDeson: '0.00',
            vFCP: '0.00',
            vBCST: '0.00',
            vST: '0.00',
            vFCPST: '0.00',
            vFCPSTRet: '0.00',
            vProd: tot.vProd.toFixed(2),
            vFrete: '0.00',
            vSeg: '0.00',
            vDesc: '0.00',
            vII: tot.vII.toFixed(2),
            vIPI: tot.vIPI.toFixed(2),
            vIPIDevol: '0.00',
            vPIS: tot.vPIS.toFixed(2),
            vCOFINS: tot.vCOFINS.toFixed(2),
            vOutro: tot.vOutro.toFixed(2),
            vNF: vNF.toFixed(2),
          },
          // Reforma 2026: totais IBS/CBS + vNFTot (vNF + vIBS + vCBS).
          IBSCBSTot: {
            vBCIBSCBS: tot.vBCIBS.toFixed(2),
            gIBS: {
              gIBSUF: { vDif: '0.00', vDevTrib: '0.00', vIBSUF: tot.vIBSUF.toFixed(2) },
              gIBSMun: { vDif: '0.00', vDevTrib: '0.00', vIBSMun: tot.vIBSMun.toFixed(2) },
              vIBS: tot.vIBS.toFixed(2),
              vCredPres: '0.00',
              vCredPresCondSus: '0.00',
            },
            gCBS: {
              vDif: '0.00', vDevTrib: '0.00', vCBS: tot.vCBS.toFixed(2),
              vCredPres: '0.00', vCredPresCondSus: '0.00',
            },
            gMono: {
              vIBSMono: '0.00', vCBSMono: '0.00', vIBSMonoReten: '0.00',
              vCBSMonoReten: '0.00', vIBSMonoRet: '0.00', vCBSMonoRet: '0.00',
            },
            gEstornoCred: { vIBSEstCred: '0.00', vCBSEstCred: '0.00' },
          },
          vNFTot: (vNF + tot.vIBS + tot.vCBS).toFixed(2),
        },
        transp: { modFrete: '9' }, // sem frete (importação)
        pag: { detPag: { tPag: '90', vPag: '0.00' } }, // sem pagamento
        ...(dados.infCpl ? { infAdic: { infCpl: dados.infCpl } } : {}),
        infRespTec: {
          CNPJ: (dados.respTec?.cnpj || cnpj).replace(/\D/g, ''),
          xContato: dados.respTec?.contato || 'MARIO CESAR FERNANDES',
          email: dados.respTec?.email || 'mario.fernandes@melopecas.com.br',
          fone: (dados.respTec?.fone || '9221214044').replace(/\D/g, ''),
        },
      },
    },
  };

  const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele(xmlObj).end({ prettyPrint: true });

  return {
    modo,
    cod_exportador: codExportador,
    seq_nota: seqNota,
    chave,
    xml,
    totais: {
      vProd: tot.vProd,
      vII: tot.vII,
      vIPI: tot.vIPI,
      vPIS: tot.vPIS,
      vCOFINS: tot.vCOFINS,
      vICMS: tot.vICMS,
      vNF,
    },
  };
}

/**
 * Gera a(s) NF-e de nacionalização conforme o modo.
 *  - POR_DI: 1 nota com todos os itens (quebra a cada 990).
 *  - POR_EXPORTADOR: agrupa por cExportador da adição → 1 nota por exportador (quebra a cada 990).
 *
 * `numeroNFInicial` é o nNF da primeira nota; cada nota adicional incrementa (o chamador
 * deve reservar a faixa de numeração). Não transmite — só monta o XML (preview).
 */
export function gerarNotasNacionalizacao(
  dados: DadosNacionalizacao,
  numeroNFInicial = '1',
): NotaNacionalizacaoGerada[] {
  const modo: ModoEmissaoImportacao = dados.modo ?? 'POR_DI';
  let nnf = parseInt(numeroNFInicial, 10) || 1;
  const notas: NotaNacionalizacaoGerada[] = [];

  // Agrupa os itens conforme o modo
  const grupos: { cod?: string; itens: ItemImportacaoNfe[] }[] = [];
  if (modo === 'POR_EXPORTADOR') {
    const porExp = new Map<string, ItemImportacaoNfe[]>();
    for (const it of dados.itens) {
      const key = it.adicao?.cod_exportador || '(sem exportador)';
      if (!porExp.has(key)) porExp.set(key, []);
      porExp.get(key)!.push(it);
    }
    for (const [cod, itens] of porExp) grupos.push({ cod, itens });
  } else {
    grupos.push({ itens: dados.itens });
  }

  for (const g of grupos) {
    // Quebra de 990 itens por NF-e
    for (let i = 0; i < g.itens.length; i += LIMITE_ITENS_NFE) {
      const lote = g.itens.slice(i, i + LIMITE_ITENS_NFE);
      const seq = Math.floor(i / LIMITE_ITENS_NFE) + 1;
      notas.push(montarUmaNota(dados, lote, modo, g.cod, seq, String(nnf)));
      nnf += 1;
    }
  }

  return notas;
}

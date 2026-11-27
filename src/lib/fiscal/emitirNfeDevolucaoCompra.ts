/**
 * Emite a NF-e da devolução de compra a partir da fatura já gravada
 * (lib/compras/faturarDevolucao.ts): saída (tpNF=1), finalidade devolução (finNFe=4),
 * referência à NF do fornecedor (refNFe = chave da entrada), sem pagamento (tPag 90).
 *
 * Os impostos vêm prontos da dbprodfat (espelho da NF do fornecedor) — o normalizador roda
 * em "modo espelho" (nada recalculado). Ambiente = dadosempresa.ambiente (homologação '2').
 * Base: pages/api/faturamento/emitir-devolucao.ts (devolução de venda, tpNF=0).
 */
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { gerarXMLNFe } from '@/components/services/sefazNfe/gerarXml';
import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { normalizarPayloadNFe } from '@/utils/normalizarPayloadNFe';
import { decrypt } from '@/utils/crypto';
import { getUrlSefazAtual } from '@/utils/gerarXmlCupomFiscal';
import { ieEmitentePorSerie } from '@/lib/faturamento/fiscalPorArmazem';
import { danfeDoXmlNfe } from '@/lib/danfe/danfeDoXmlNfe';
import { gerarPdfNotaHtml } from '@/lib/danfe/gerarPdfNotaHtml';
import { enfileirarImpressaoDanfe } from '@/lib/impressao/filaImpressao';
import type { PagamentoNota } from '@/lib/fiscal/pagamentoNota';

type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

// Município (IBGE) do emitente pela UF da filial.
const CMUN_EMITENTE: Record<string, string> = { AM: '1302603', RR: '1400100', RO: '1100205' };

export interface ResultadoEmissaoDevolucao {
  autorizada: boolean;
  status: string;
  motivo: string;
  chave: string | null;
  protocolo: string | null;
  ambiente: string;
  /** DANFE gerado e gravado em dbfat_nfe.imagem. */
  danfe?: boolean;
  /** DANFE enviado à fila do Robô de Impressão. */
  naFila?: boolean;
}

/** Monta o XML assinado da NF de devolução (sem transmitir). Usado também para validar o XSD. */
export async function montarXmlDevolucaoCompra(
  db: Db,
  codfat: string,
  schema: string,
  certificado?: { key: string; crt: string },
  opcoes?: { semAssinatura?: boolean },
) {
  const dbfatura = (await db.query(`SELECT * FROM dbfatura WHERE codfat = $1`, [codfat])).rows[0];
  if (!dbfatura) throw new Error(`Fatura ${codfat} não encontrada.`);
  if (!dbfatura.dev_id) throw new Error(`A fatura ${codfat} não é de devolução.`);

  const dev = (await db.query(
    `SELECT d.dev_obs, e.chave FROM fat_devolucao d JOIN dbent e ON e.codent = d.dev_coddoc
      WHERE d.dev_id = $1 AND d.dev_tipodoc = 'ENTRADA'`,
    [String(dbfatura.dev_id)],
  )).rows[0];
  const refNFe = String(dev?.chave ?? '').replace(/\D/g, '').slice(-44);
  if (refNFe.length !== 44) throw new Error('Chave da NF do fornecedor não encontrada para referenciar.');

  const dbclien = (await db.query(`SELECT * FROM dbclien WHERE codcli = $1`, [dbfatura.codcli])).rows[0] || {};

  const itens = (await db.query(
    `SELECT * FROM dbprodfat WHERE codfat = $1 ORDER BY nroitemnfe NULLS LAST, codprod`,
    [codfat],
  )).rows;
  if (!itens.length) throw new Error('Fatura sem itens.');
  // % devolvido por produto (impostoDevol.pDevol), como o Delphi: fat_it_devolucao.itd_percentual.
  const perc = new Map<string, number>(
    (await db.query(
      `SELECT itd_codprod, MAX(itd_percentual)::numeric AS p FROM fat_it_devolucao
        WHERE itd_dev_id = $1 GROUP BY itd_codprod`,
      [String(dbfatura.dev_id)],
    )).rows.map((r: any) => [r.itd_codprod, Number(r.p) || 0]),
  );
  const dbitvenda = itens.map((r: any) => ({
    ...r,
    qtd: r.qtde,
    pdevol: perc.get(r.codprod) ?? 0,
    dbprod: { descr: r.descr, clasfiscal: String(r.ncm ?? '').replace(/\D/g, '') },
  }));

  const emp = (await db.query(
    `SELECT * FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
      ORDER BY (regexp_replace(COALESCE(cgc,''),'\\D','','g') LIKE '04618302%') DESC, cgc
      LIMIT 1`,
  )).rows[0];
  if (!emp) throw new Error('Nenhuma empresa com certificado configurado.');
  const ambiente = String(emp.ambiente || process.env.AMBIENTE_NFCE || '2');
  const uf = String(emp.uf || 'AM').toUpperCase();

  const emitente: any = {
    cnpj: emp.cgc,
    cgc: emp.cgc,
    xNome: emp.nomecontribuinte,
    nomecontribuinte: emp.nomecontribuinte,
    ie: emp.inscricaoestadual,
    inscricaoestadual: emp.inscricaoestadual,
    crt: emp.crt || '3',
    enderEmit: {
      xLgr: emp.logradouro,
      nro: emp.numero,
      xBairro: emp.bairro,
      cMun: CMUN_EMITENTE[uf] ?? '1302603',
      xMun: emp.municipio,
      UF: uf,
      CEP: emp.cep,
    },
    uf,
  };
  try {
    const ie = await ieEmitentePorSerie(db, emp.cgc, dbfatura.serie || '1', schema);
    if (ie) {
      emitente.ie = ie;
      emitente.inscricaoestadual = ie;
    }
  } catch {
    /* segue com a IE do cadastro */
  }

  // Transporte e volumes (cabeçalho da fatura) + texto complementar.
  let nomeTransp = '';
  if (dbfatura.codtransp) {
    nomeTransp = (await db.query(`SELECT nome FROM dbtransp WHERE codtransp = $1`, [dbfatura.codtransp])).rows[0]?.nome ?? '';
  }
  const obs = [String(dev?.dev_obs ?? '').trim(), String(dbfatura.info_compl ?? '').trim()].filter(Boolean).join(' | ');
  const dbvenda = {
    obs,
    especie: dbfatura.especie ?? '',
    marca: dbfatura.marca ?? '',
    numero: dbfatura.numero ?? '',
    quantidade: dbfatura.quatidade ?? '1',
    pesoBruto: dbfatura.psbruto ?? '0',
    pesoLiquido: dbfatura.psliquido ?? '0',
  };

  const norm: any = await normalizarPayloadNFe({
    codfat,
    dbfatura,
    dbvenda,
    dbclien,
    dbitvenda,
    produtos: dbitvenda,
    emitente,
    modoEspelho: true,
  });
  norm.transportadora = nomeTransp;

  const ufDest = String(dbclien.uf ?? '').toUpperCase();
  const xmlBruto = gerarXMLNFe({
    ...norm,
    ambiente,
    naturezaOperacao: dbfatura.descrcfop || 'DEVOLUCAO DE COMPRA',
    tpNF: '1', // saída
    finNFe: '4', // devolução
    refNFe,
    idDest: ufDest && ufDest !== uf ? '2' : '1',
    indFinal: '0', // destinatário é o fornecedor (não consumidor final), como o Delphi
    cMunDest: String(dbclien.codmunicipio ?? '').replace(/\D/g, ''),
    pagamentoNota: { tPag: '90', vPagZero: true } satisfies PagamentoNota,
  });

  if (opcoes?.semAssinatura) {
    return { dbfatura, xmlBruto, xmlAssinado: '', chave: xmlBruto.match(/Id="NFe(\d{44})"/)?.[1] ?? '', ambiente, key: '', crt: '', cadeia: null, refNFe, emitente };
  }
  let key = certificado?.key ?? '';
  let crt = certificado?.crt ?? '';
  let cadeia: string | null = null;
  if (!certificado) {
    key = (await decrypt(emp.certificadoKey)) || '';
    crt = (await decrypt(emp.certificadoCrt)) || '';
    cadeia = emp.cadeiaCrt ? await decrypt(emp.cadeiaCrt) : null;
    if (!key || !crt) throw new Error('Não foi possível abrir o certificado da empresa.');
  }
  const xmlAssinado = await assinarXMLComCertificados(xmlBruto, 'infNFe', key, crt);
  const chave = xmlAssinado.match(/Id="NFe(\d{44})"/)?.[1] ?? '';
  return { dbfatura, xmlBruto, xmlAssinado, chave, ambiente, key, crt, cadeia, refNFe, emitente };
}

/**
 * DANFE em PDF a partir do XML autorizado (mesmo gerador paginado da nacionalização: o
 * DANFE sai igual ao XML — itens, CFOP, impostos e informações complementares).
 */
/**
 * Confere, antes de gravar a fatura, se o certificado da empresa abre (chave de criptografia
 * configurada e certificado cadastrado). Erro de configuração não deve deixar fatura sem NF.
 */
export async function conferirCertificadoEmissao(db: Db): Promise<void> {
  const emp = (await db.query(
    `SELECT "certificadoKey", "certificadoCrt" FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
      ORDER BY (regexp_replace(COALESCE(cgc,''),'\\D','','g') LIKE '04618302%') DESC, cgc
      LIMIT 1`,
  )).rows[0];
  if (!emp) throw new Error('Nenhuma empresa com certificado configurado.');
  const key = (await decrypt(emp.certificadoKey)) || '';
  const crt = (await decrypt(emp.certificadoCrt)) || '';
  if (!key || !crt) throw new Error('Não foi possível abrir o certificado da empresa.');
}

export async function gerarPdfDanfeDevolucao(
  xmlAssinado: string,
  protocolo: string | null,
  emitente: any,
  ambiente: string,
): Promise<Buffer> {
  const dx = danfeDoXmlNfe(xmlAssinado, { protocolo });
  return gerarPdfNotaHtml(
    'nfe-importacao',
    dx.fatura,
    dx.produtos,
    dx.venda,
    { ...emitente, ...dx.emitente, telefone: emitente?.telefone || dx.emitente?.telefone },
    { ...dx.dadosNFe, protocolo: protocolo || dx.dadosNFe?.protocolo },
    { homologacao: ambiente === '2', entrada: false },
  );
}

/** Assina, transmite e grava o resultado em dbfat_nfe (autorizada ou rejeitada). */
export async function emitirNfeDevolucaoCompra(db: Db, codfat: string, schema: string): Promise<ResultadoEmissaoDevolucao> {
  const ja = await db.query(`SELECT chave FROM dbfat_nfe WHERE codfat = $1 AND status = '100' LIMIT 1`, [codfat]);
  if (ja.rowCount) throw new Error(`A NF desta devolução já foi autorizada (chave ${ja.rows[0].chave}).`);

  const m = await montarXmlDevolucaoCompra(db, codfat, schema);
  const url = getUrlSefazAtual('NFE_AUTORIZACAO', m.ambiente);
  const xmlNFe = m.xmlAssinado.replace(/^<\?xml[^>]*\?>/, '').trim();
  const envi = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>000000000000001</idLote><indSinc>1</indSinc>${xmlNFe}</enviNFe>`;
  const envelope = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${envi}</nfeDadosMsg></soap:Body></soap:Envelope>`;
  const agent = new https.Agent({
    key: Buffer.from(m.key),
    cert: Buffer.from(m.crt),
    ca: m.cadeia ? Buffer.from(m.cadeia) : undefined,
    rejectUnauthorized: false,
  });
  const resp = await axios.post(url, envelope, {
    httpsAgent: agent,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
    },
    timeout: 30000,
  });
  const json = await parseStringPromise(resp.data, {
    explicitArray: false,
    tagNameProcessors: [(n: string) => n.split(':').pop() || n],
  });
  const ret = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe;
  if (!ret) throw new Error('Resposta inesperada da SEFAZ.');
  const inf = ret.cStat === '104' ? ret.protNFe?.infProt : null;
  const status = String(inf?.cStat ?? ret.cStat);
  const motivo = String(inf?.xMotivo ?? ret.xMotivo ?? '');
  const protocolo = inf?.nProt ?? null;
  const chave = inf?.chNFe ?? m.chave;
  const autorizada = status === '100';

  // DANFE em PDF (só autorizada). Falha no PDF não derruba a nota: ela já está autorizada.
  let pdf: Buffer | null = null;
  if (autorizada) {
    try {
      pdf = await gerarPdfDanfeDevolucao(m.xmlAssinado, protocolo, m.emitente, m.ambiente);
    } catch (e: any) {
      console.error(`DANFE da devolução ${codfat} não gerado:`, e?.message ?? e);
    }
  }

  await db.query(
    `INSERT INTO dbfat_nfe
       (codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, xmlremessa, xmlretorno,
        status, numprotocolo, dthrprotocolo, motivo, tipo_emissao, modelo, tpemissao, imagem, emailenviado)
     VALUES ($1,$2,$3,now(),$4,'4.00',$5,$6,$7,$8,$9,$10,1,'55','1',$11,'N')`,
    [
      codfat, m.dbfatura.nroform || '', String(chave).substring(35, 43), chave, m.xmlAssinado,
      typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data),
      status, protocolo, autorizada ? new Date() : null, motivo.slice(0, 255), pdf,
    ],
  );

  // Fila do Robô de Impressão (fin_impressao), como na emissão do faturamento.
  let naFila = false;
  if (autorizada && pdf) naFila = await enfileirarImpressaoDanfe(db as any, codfat);

  return { autorizada, status, motivo, chave: chave || null, protocolo, ambiente: m.ambiente, danfe: !!pdf, naFila };
}

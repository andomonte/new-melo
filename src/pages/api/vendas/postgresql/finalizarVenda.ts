import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type { DadosCalculoImposto } from '@/lib/impostos/types';

/* ------------------------------------------------
 * Logger
 * ----------------------------------------------*/
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
      if (e?.detail) console.error('detail:', e.detail);
      if (e?.hint) console.error('hint:', e.hint);
    }
  };
  return { traceId, log, err };
}

/* ------------------------------------------------
 * Tipos
 * ----------------------------------------------*/
type ItemPayload = {
  codprod: string;
  qtd: number;
  prunit: number;
  arm_id: number;
  ref?: string;
  descr?: string;
  desconto?: number;
  codvend?: string | null;
  codoperador?: string | null;
  nritem?: string | null;
  icms?: number | null;
  ipi?: number | null;
  totalipi?: number | null;
  baseicms?: number | null;
  totalicms?: number | null;
  mva?: number | null;
  basesubst_trib?: number | null;
  totalsubst_trib?: number | null;
  baseipi?: number | null;
  icmsinterno_dest?: number | null;
  icmsexterno_orig?: number | null;
  totalproduto?: number | null | string;
  totalicmsdesconto?: number | null;
  pis?: number | null;
  cofins?: number | null;
  basepis?: number | null;
  valorpis?: number | null;
  basecofins?: number | null;
  valorcofins?: number | null;
  fretebase?: number | null;
  acrescimo?: number | null;
  freteicms?: number | null;
  fcp?: number | null;
  base_fcp?: number | null;
  valor_fcp?: number | null;
  fcp_subst?: number | null;
  basefcp_subst?: number | null;
  valorfcp_subst?: number | null;
  ftp_st?: number | null;
  fcp_substret?: number | null;
  basefcp_substret?: number | null;
  valorfcp_substret?: number | null;
  codint?: string | null;
  cfop?: string | null;
  tipocfop?: string | null;
  ncm?: string | null;
  cstipi?: string | null;
  cstpis?: string | null;
  cstcofins?: string | null;
  csticms?: string | null;
  // IBS/CBS (Reforma Tributária)
  aliquota_ibs?: number | null;
  aliquota_cbs?: number | null;
  valor_ibs?: number | null;
  valor_cbs?: number | null;
  ibs_e?: number | null; // IBS Estadual (substitui ICMS)
  ibs_m?: number | null; // IBS Municipal (substitui ISS)

  id_promocao_item?: number | null;
  promoQty?: number | null;
  quantidade_promocional?: number | null;
  promocao?: {
    id_promocao_item?: number;
    promoQty?: number;
    quantidade_promocional?: number;
  } | null;
  promoInfo?: {
    id_promocao_item?: number;
    promoQty?: number;
    quantidade_promocional?: number;
  } | null;
};

type PrazoIn = {
  data?: string | Date;
  dia?: number;
  dataVencimento?: string | Date;
  dias?: number;
  vencimento?: string | Date;
  parcela?: number;
  valor?: number;
};

type Body = {
  header?: {
    operacao?: number;
    codcli: string;
    codusr: string | number;
    pedido?: string;
    tipo: string;
    tele?: 'S' | 'N';
    transp?: string;
    codtptransp?: string | number;
    vlrfrete?: number;
    prazo?: string;
    tipo_desc?: string;
    obs?: string;
    obsfat?: string;
    bloqueada?: 'S' | 'N' | '0' | '1';
    estoque_virtual?: 'S' | 'N';
    uName?: string;
    localentregacliente?: string | null;
    vendedor?: string | null;
    operador?: string | null;
    nomecf?: string | null;
    nroimp?: string | number;
    tipodoc?: string;
    draft_id?: string;
  };
  itens: ItemPayload[];
  prazos?: PrazoIn[];
};

/* ------------------------------------------------
 * Helpers
 * ----------------------------------------------*/
function n(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
const sn = (v: any) => (String(v ?? '').toUpperCase() === 'S' ? 'S' : 'N');
const nul = <T>(v: T | undefined | null | '') =>
  v === undefined || v === null || v === '' ? null : v;

function truncN(s: any, len: number): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  return str ? str.slice(0, len) : null;
}

function normalizePrazos(input: any): Array<{ data: Date; dia: number }> {
  if (!Array.isArray(input)) return [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return input.map((p: any) => {
    const rawDate = p?.data ?? p?.dataVencimento ?? p?.vencimento;
    let data: Date | null = rawDate ? new Date(rawDate as any) : null;
    let dia: number | null = p?.dia ?? p?.dias ?? null;

    if (dia == null && data) {
      const d = new Date(data);
      d.setHours(0, 0, 0, 0);
      dia = Math.round((+d - +hoje) / 86400000);
    }
    if (!data && typeof dia === 'number') {
      data = new Date(hoje);
      data.setDate(hoje.getDate() + dia);
    }
    if (!data) data = new Date(hoje);
    if (dia == null) dia = 0;

    return { data, dia };
  });
}

function extractPromoDeltas(itens: ItemPayload[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const it of itens) {
    const id =
      it?.id_promocao_item ??
      it?.promocao?.id_promocao_item ??
      it?.promoInfo?.id_promocao_item;

    const qtd =
      it?.promoInfo?.promoQty ??
      it?.promoInfo?.quantidade_promocional ??
      it?.promocao?.promoQty ??
      it?.promocao?.quantidade_promocional ??
      it?.promoQty ??
      it?.quantidade_promocional ??
      null;

    if (
      typeof id === 'number' &&
      id > 0 &&
      typeof qtd === 'number' &&
      qtd > 0
    ) {
      map.set(id, (map.get(id) ?? 0) + qtd);
    }
  }
  return map;
}

const TIPODOC_ALLOWED = new Set(['B', 'C', 'D', 'P', 'E', 'N', 'F', 'O']);
function mapTipodoc(
  tipo: string | undefined,
  override?: string | null,
): string {
  const o = (override ?? '').toUpperCase();
  if (TIPODOC_ALLOWED.has(o)) return o;
  const t = (tipo ?? '').toUpperCase();
  if (t === 'P' || t === '1' || t === '2') return 'F';
  return TIPODOC_ALLOWED.has(t) ? t : 'F';
}
function pickArmazem(itens: ItemPayload[]): number | null {
  const a = itens?.[0]?.arm_id;
  const num = Number(a);
  return Number.isFinite(num) ? num : null;
}
function pad2(v: any): string {
  return String(v ?? '01')
    .padStart(2, '0')
    .slice(-2);
}

/* ------------------------------------------------
 * Normalização de header
 * ----------------------------------------------*/
function normalizeHeaderPg(h: NonNullable<Body['header']>) {
  const codtp = n(h.codtptransp) === 0 ? null : n(h.codtptransp);
  const oper = n(h.operacao) === 0 ? null : n(h.operacao);
  return {
    ...h,
    tele: String(h.tele ?? '').toUpperCase() === 'S' ? 'S' : 'N',
    cancel: 'N',
    estoque_virtual: 'N',
    statusest: null as null,
    impresso: 'N' as any,
    vlrfrete: n(h.vlrfrete),
    codtptransp: codtp,
    operacao: oper ?? 1,
    numeroserie: 'SO PRENOTA TEM NUMERO DE SERIE',
    obs: nul(h.obs),
    obsfat: nul(h.obsfat),
    localentregacliente: h.localentregacliente ?? null,
  };
}

/* ------------------------------------------------
 * Status
 * ----------------------------------------------*/
function initialStatus(
  tipo: string,
  bloqueada: 'S' | 'N' | '0' | '1',
  uf: string,
): string {
  const t = (tipo ?? '').toUpperCase();
  const blq = sn(bloqueada);
  if (blq === 'S' || bloqueada === '1') return 'R';
  if (uf === 'AM') {
    if (t === 'P' || t === '1' || t === '2' || t === '3') return 'N';
    return 'N';
  } else {
    return 'N';
  }
}

/* ------------------------------------------------
 * NextPgIds
 * ----------------------------------------------*/
async function nextPgIds(
  client: PoolClient,
  tipo: string,
): Promise<{ codvenda: string; nrovenda: string }> {
  const qCod = `
    SELECT LPAD(
             (COALESCE(MAX(NULLIF(regexp_replace(codvenda, '\\D', '', 'g'), '')::bigint), 0) + 1)::text,
             9, '0'
           ) AS next_cod
      FROM dbvenda
  `;
  const qNro = `
    SELECT LPAD(
             (COALESCE(MAX(NULLIF(regexp_replace(nrovenda, '\\D', '', 'g'), '')::bigint), 0) + 1)::text,
             9, '0'
           ) AS next_nro
      FROM dbvenda
     WHERE tipo = $1
  `;

  const [rCod, rNro] = await Promise.all([
    client.query(qCod),
    client.query(qNro, [tipo]),
  ]);

  const codvenda = rCod.rows[0]?.next_cod || '000000001';
  const nrovenda = rNro.rows[0]?.next_nro || '000000001';

  return { codvenda, nrovenda };
}

/* ------------------------------------------------
 * Busca CNPJ e IE da empresa pelo armazém
 * ----------------------------------------------*/
async function getEmpresaDataByArmazem(
  client: PoolClient,
  armId: number | null,
): Promise<{ cnpj: string | null; ie: string | null }> {
  if (!armId) return { cnpj: null, ie: null };

  try {
    const result = await client.query(
      `SELECT ie.cgc, a.inscricaoestadual
       FROM dbarmazem a
       LEFT JOIN db_ie ie ON a.inscricaoestadual = ie.inscricaoestadual
       WHERE a.id_armazem = $1
       LIMIT 1`,
      [armId],
    );

    if (result.rows.length > 0) {
      return {
        cnpj: result.rows[0].cgc || null,
        ie: result.rows[0].inscricaoestadual || null,
      };
    }
  } catch (e) {
    console.error('[finalizarVenda] Erro ao buscar dados empresa do armazém:', e);
  }

  return { cnpj: null, ie: null };
}

/* ------------------------------------------------
 * Postgres - INSERT Venda
 * ----------------------------------------------*/
async function insertPgVenda(
  client: PoolClient,
  ids: { codvenda: string; nrovenda: string },
  h: ReturnType<typeof normalizeHeaderPg>,
  status: string,
  total: number,
  empresaData: { cnpj: string | null; ie: string | null },
) {
  const DEFAULT_NUMEROSERIE = 'SO PRENOTA TEM NUMERO DE SERIE';

  await client.query(
    `INSERT INTO dbvenda (
       operacao, codvenda, codusr, codvend, nrovenda, codcli, data, total, nronf, pedido,
       status, transp, prazo, obs, tipo_desc, tipo, tele, cancel, statusest, impresso,
       vlrfrete, codtptransp, bloqueada, estoque_virtual, numeroserie, numerocupom,
       obsfat, localentregacliente, statuspedido, dtupdate, cnpj_empresa, ie_empresa
     ) VALUES (
       $1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,NULL,$8,
       $9,$10,$11,$12,$13,$14,$15,'N',NULL,'N',
       $16,$17,'0','N',$18,NULL,$19,$20, 1, CURRENT_TIMESTAMP, $21, $22
     )`,
    [
      h.operacao ?? null,
      ids.codvenda,
      String(h.codusr),
      h.vendedor ?? String(h.codusr), // codvend: vendedor selecionado ou usuário logado
      ids.nrovenda,
      h.codcli,
      total,
      h.pedido ?? null,
      status,
      h.transp ?? null,
      h.prazo ?? null,
      h.obs ?? null,
      h.tipo_desc ?? null,
      h.tipo,
      h.tele ?? 'N',
      h.vlrfrete,
      h.codtptransp,
      h.numeroserie ?? DEFAULT_NUMEROSERIE,
      h.obsfat ?? null,
      h.localentregacliente ?? null,
      empresaData.cnpj,
      empresaData.ie,
    ],
  );

  if (h.vendedor) {
    await client.query(
      `INSERT INTO dbvvend (codvend, codvenda, operador) VALUES ($1,$2,'N')`,
      [h.vendedor, ids.codvenda],
    );
  }
  if (h.tele === 'S' && h.operador) {
    await client.query(
      `INSERT INTO dbvvend (codvend, codvenda, operador) VALUES ($1,$2,'S')`,
      [h.operador, ids.codvenda],
    );
  }
}

/* ------------------------------------------------
 * Calcula impostos para itens usando CalculadoraImpostos
 * -----------------------------------------------*/
async function calcularImpostosItens(
  client: PoolClient,
  itens: ItemPayload[],
  codcli: string,
  tipoOperacao: string,
  log: (...args: any[]) => void,
): Promise<ItemPayload[]> {
  const calculadora = new CalculadoraImpostos(client);
  const itensComImpostos: ItemPayload[] = [];
  const clienteId = parseInt(codcli);

  log('calculando impostos para', itens.length, 'itens');

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];

    try {
      // Se o item já vem com impostos do frontend, pular cálculo
      const temImpostos =
        item.icms !== undefined &&
        item.icms !== null &&
        item.baseicms !== undefined &&
        item.baseicms !== null;

      if (temImpostos) {
        log(`item ${i + 1}: usando impostos do frontend`);
        itensComImpostos.push(item);
        continue;
      }

      // Buscar NCM do produto
      const prodResult = await client.query(
        `SELECT clasfiscal as ncm FROM dbprod WHERE codprod = $1 LIMIT 1`,
        [item.codprod]
      );

      if (prodResult.rows.length === 0) {
        throw new Error(`Produto ${item.codprod} não encontrado`);
      }

      const ncm = (prodResult.rows[0].ncm || '').replace(/\D/g, '').substring(0, 8);

      // Preparar dados para cálculo
      const dados: DadosCalculoImposto = {
        ncm: ncm,
        valor_produto: item.prunit,
        quantidade: item.qtd,
        desconto: item.desconto || 0,
        cliente_id: clienteId,
        tipo_operacao: mapTipoOperacaoParaCalculo(tipoOperacao),
      };

      // Calcular impostos
      const resultado = await calculadora.calcular(dados);

      // Preencher item com impostos calculados
      const itemComImpostos: ItemPayload = {
        ...item,
        // ICMS
        icms: resultado.icms,
        baseicms: resultado.baseicms,
        totalicms: resultado.totalicms,
        icmsinterno_dest: resultado.icmsinterno_dest,
        icmsexterno_orig: resultado.icmsexterno_orig,
        csticms: resultado.csticms,
        // ST
        mva: resultado.mva,
        basesubst_trib: resultado.basesubst_trib,
        totalsubst_trib: resultado.totalsubst_trib,
        // IPI
        ipi: resultado.ipi,
        baseipi: resultado.baseipi,
        totalipi: resultado.totalipi,
        cstipi: resultado.cstipi,
        // PIS
        pis: resultado.pis,
        basepis: resultado.basepis,
        valorpis: resultado.valorpis,
        cstpis: resultado.cstpis,
        // COFINS
        cofins: resultado.cofins,
        basecofins: resultado.basecofins,
        valorcofins: resultado.valorcofins,
        cstcofins: resultado.cstcofins,
        // FCP
        fcp: resultado.fcp,
        base_fcp: resultado.base_fcp,
        valor_fcp: resultado.valor_fcp,
        fcp_subst: resultado.fcp_subst,
        basefcp_subst: resultado.basefcp_subst,
        valorfcp_subst: resultado.valorfcp_subst,
        // CFOP e NCM
        cfop: resultado.cfop,
        tipocfop: resultado.tipocfop,
        ncm: resultado.ncm,
        // Total produto
        totalproduto: resultado.valor_total_item,
        // IBS/CBS (Reforma Tributária)
        aliquota_ibs: resultado.ibs_aliquota,
        aliquota_cbs: resultado.cbs_aliquota,
        valor_ibs: resultado.ibs_valor,
        valor_cbs: resultado.cbs_valor,
        ibs_e: resultado.ibs_e, // IBS Estadual (substitui ICMS)
        ibs_m: resultado.ibs_m, // IBS Municipal (substitui ISS)
      };

      log(`item ${i + 1}: impostos calculados`, {
        codprod: item.codprod,
        icms: resultado.icms,
        st: resultado.tem_st,
        cfop: resultado.cfop,
      });

      itensComImpostos.push(itemComImpostos);
    } catch (error: any) {
      log(`ERRO ao calcular impostos para item ${i + 1}:`, error?.message);
      // Em caso de erro, usar item original (fallback)
      itensComImpostos.push(item);
    }
  }

  return itensComImpostos;
}

/**
 * Mapeia tipo de operação da venda para tipo do cálculo
 */
function mapTipoOperacaoParaCalculo(tipo: string): any {
  const t = String(tipo).toUpperCase();
  if (t === '1' || t === '2' || t === 'P' || t.includes('VENDA')) return 'VENDA';
  if (t.includes('TRANSFERENCIA') || t === 'T') return 'TRANSFERENCIA';
  if (t.includes('BONIFICACAO') || t === 'B') return 'BONIFICACAO';
  if (t.includes('DEVOLUCAO') || t === 'D') return 'DEVOLUCAO';
  if (t.includes('EXPORTACAO') || t === 'E') return 'EXPORTACAO';
  return 'VENDA';
}

/* ------------------------------------------------
 * Postgres - INSERT Itens + Estoque
 * ----------------------------------------------*/
async function insertPgItensAndStock(
  client: PoolClient,
  ids: { codvenda: string },
  itens: ItemPayload[],
) {
  for (const it of itens) {
    if (!it.codprod || !it.qtd || !it.prunit || !it.arm_id)
      throw new Error(
        `Item inválido (codprod/qtd/prunit/arm_id obrigatórios).`,
      );

    // RESERVA DE ESTOQUE: Ao finalizar a venda, apenas reservamos o estoque
    // incrementando arp_qtest_reservada. O estoque físico (arp_qtest) só será
    // decrementado no momento do faturamento.
    // Disponível = arp_qtest - arp_qtest_reservada
    const updArm = await client.query(
      `UPDATE cad_armazem_produto
        SET arp_qtest_reservada = COALESCE(arp_qtest_reservada, 0) + $1
        WHERE arp_codprod = $2 AND arp_arm_id = $3
        AND (COALESCE(arp_qtest, 0) - COALESCE(arp_qtest_reservada, 0)) >= $1`,
      [it.qtd, it.codprod, it.arm_id],
    );
    if (updArm.rowCount !== 1)
      throw new Error(
        `ESTOQUE INSUFICIENTE - REF: ${it.ref ?? it.codprod} | ARMAZEM: ${
          it.arm_id
        }`,
      );

    // NOTA: Não atualizamos dbprod.qtest aqui porque estamos apenas reservando.
    // O estoque total só será decrementado no faturamento.

    const p = await client.query(
      `SELECT descr, ref, prcompra, prmedio, dolar, txdolarcompra FROM dbprod WHERE codprod = $1`,
      [it.codprod],
    );
    const prow = p.rows?.[0] || {};
    const descr = truncN(it.descr ?? (prow.descr as string) ?? '', 60) ?? '';
    const ref = it.ref ?? (prow.ref as string) ?? null;
    const dolar = (prow.dolar as string) === 'S';
    const txdol = Number(prow.txdolarcompra ?? 1);
    const prcompra = Number(prow.prcompra ?? 0) * (dolar ? txdol : 1);
    const prmedio = Number(prow.prmedio ?? 0) * (dolar ? txdol : 1);

    await client.query(
      `INSERT INTO dbitvenda (
         codvenda, codprod, prunit, qtd, demanda, descr, comissao, origemcom,
         codvend, codoperador, prcompra, prmedio, desconto, nrequis, nritem, arm_id, ref,
         aliquota_icms, aliquota_ipi, icms, ipi, totalipi, baseicms, totalicms, mva, basesubst_trib, totalsubst_trib,
         baseipi, icmsinterno_dest, icmsexterno_orig, totalproduto, totalicmsdesconto,
         pis, cofins, basepis, valorpis, basecofins, valorcofins,
         fretebase, acrescimo, freteicms,
         fcp, base_fcp, valor_fcp, fcp_subst, basefcp_subst, valorfcp_subst,
         ftp_st, fcp_substret, basefcp_substret, valorfcp_substret,
         codint, cfop, tipocfop, ncm, cstipi, cstpis, cstcofins, csticms,
         aliquota_ibs, aliquota_cbs, valor_ibs, valor_cbs, ibs_e, ibs_m
       ) VALUES (
         $1,$2,$3,$4,'S',$5,NULL,NULL,
         $6,$7,$8,$9,$10,NULL,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
         $24,$25,$26,$27,$28,
         $29,$30,$31,$32,$33,$34,
         $35,$36,$37,
         $38,$39,$40,$41,$42,$43,
         $44,$45,$46,$47,
         $48,$49,$50,$51,$52,$53,$54,$55,
         $56,$57,$58,$59,$60,$61
       )`,
      [
        ids.codvenda,
        it.codprod,
        it.prunit,
        it.qtd,
        descr,
        it.codvend ?? null,
        it.codoperador ?? null,
        prcompra,
        prmedio,
        n(it.desconto),
        it.nritem ?? null,
        it.arm_id,
        ref,
        n(it.icms),              // $14 aliquota_icms = alíquota do ICMS (%)
        n(it.ipi),               // $15 aliquota_ipi = alíquota do IPI (%)
        n(it.totalicms),         // $16 icms = VALOR do ICMS (R$)
        n(it.totalipi),          // $17 ipi = VALOR do IPI (R$)
        n(it.totalipi),          // $18 totalipi (mantido para compatibilidade)
        n(it.baseicms),
        n(it.totalicms),         // totalicms (mantido para compatibilidade)
        n(it.mva),
        n(it.basesubst_trib),
        n(it.totalsubst_trib),
        n(it.baseipi),
        n(it.icmsinterno_dest),
        n(it.icmsexterno_orig),
        n(
          typeof it.totalproduto === 'string'
            ? it.totalproduto
            : (it.totalproduto as number | null),
        ),
        n(it.totalicmsdesconto),
        n(it.pis),               // pis = alíquota do PIS (%)
        n(it.cofins),            // cofins = alíquota do COFINS (%)
        n(it.basepis),
        n(it.valorpis),          // valorpis = VALOR do PIS (R$)
        n(it.basecofins),
        n(it.valorcofins),       // valorcofins = VALOR do COFINS (R$)
        n(it.fretebase),
        n(it.acrescimo),
        n(it.freteicms),
        n(it.fcp),
        n(it.base_fcp),
        n(it.valor_fcp),
        n(it.fcp_subst),
        n(it.basefcp_subst),
        n((it as any).valorfcp_subst),
        n(it.ftp_st),
        n(it.fcp_substret),
        n(it.basefcp_substret),
        n((it as any).valorfcp_substret),
        it.codint ?? null,
        it.cfop ?? null,
        truncN(it.tipocfop, 1),
        it.ncm ?? null,
        truncN(it.cstipi, 2),
        truncN(it.cstpis, 2),
        truncN(it.cstcofins, 2),
        truncN(it.csticms, 3),
        n(it.aliquota_ibs),
        n(it.aliquota_cbs),
        n(it.valor_ibs),
        n(it.valor_cbs),
        n(it.ibs_e),   // $60 IBS Estadual (substitui ICMS)
        n(it.ibs_m),   // $61 IBS Municipal (substitui ISS)
      ],
    );
  }
}

/* ------------------------------------------------
 * Postgres - INSERT ServImp
 * ----------------------------------------------*/
async function insertPgServImp(
  client: PoolClient,
  ids: { codvenda: string; nrovenda: string },
  hRaw: NonNullable<Body['header']>,
  total: number,
  armForPrint: number | null,
) {
  const tipodoc = mapTipodoc(hRaw.tipo, (hRaw as any).tipodoc);
  const nomeUsr = truncN(hRaw.uName ?? hRaw.codusr, 10);
  const nomeCf = truncN(hRaw.nomecf, 40);
  const nroimp = pad2((hRaw as any).nroimp);

  await client.query(
    `INSERT INTO dbservimp
      ("CODIGO","NRODOC","TIPODOC","CODCF","NOMECF","NOMEUSR","VALOR","DATA","HORA","NROIMP","IMPRESSO","ARMAZEM")
     VALUES
      ($1,      $2,      $3,       $4,     $5,      $6,       $7,     NOW(), to_char(now(),'HH24:MI:SS'), $8,   'N',       $9)`,
    [
      ids.codvenda,
      ids.nrovenda,
      tipodoc,
      hRaw.codcli,
      nomeCf,
      nomeUsr,
      total,
      nroimp,
      armForPrint ?? null,
    ],
  );
}

/* ------------------------------------------------
 * Postgres - Prazos & Promoções
 * ----------------------------------------------*/
async function insertPgPrazos(
  client: PoolClient,
  codvenda: string,
  prazosRaw: PrazoIn[] | undefined,
) {
  const prazos = normalizePrazos(prazosRaw || []);
  if (!prazos.length) return;
  for (const p of prazos) {
    await client.query(
      `INSERT INTO dbprazo_pagamento (data, dia, codvenda) VALUES ($1,$2,$3)`,
      [p.data, p.dia, codvenda],
    );
  }
}

async function updatePgPromocaoVendido(
  client: PoolClient,
  deltas: Map<number, number>,
) {
  if (!deltas.size) return;
  for (const [id_promocao_item, qtd] of deltas.entries()) {
    await client.query(
      `UPDATE dbpromocao_item SET qtdvendido = COALESCE(qtdvendido,0) + $2 WHERE id_promocao_item = $1`,
      [id_promocao_item, qtd],
    );
  }
}

/* ------------------------------------------------
 * Handler
 * ----------------------------------------------*/
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { traceId, log, err } = mkLogger('finalizarVenda');

  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  const body = req.body as Body;
  const h = body.header!;

  log('filial_melo:', filial || '(vazio)');
  log('payload.header:', {
    tipo: h?.tipo,
    codcli: h?.codcli,
    codusr: h?.codusr,
    vendedor: h?.vendedor,
    operador: h?.operador,
  });
  log('payload.counts:', {
    itens: Array.isArray(body?.itens) ? body.itens.length : 0,
    prazos: Array.isArray(body?.prazos) ? body.prazos.length : 0,
  });

  if (
    !h?.codusr ||
    !h?.codcli ||
    !h?.tipo ||
    !Array.isArray(body.itens) ||
    body.itens.length === 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        'Campos obrigatórios: header.codusr, header.codcli, header.tipo e itens[].',
      traceId,
    });
  }

  log(
    'arm_ids itens:',
    body.itens.map((i) => ({ codprod: i.codprod, arm_id: i.arm_id })),
  );

  let pgClient: PoolClient | null = null;

  try {
    // Conexão Postgres
    const pgPool = getPgPool(filial);
    pgClient = await pgPool.connect();

    // Transação
    await pgClient.query('BEGIN');

    // IDs + status + total
    const ids = await nextPgIds(pgClient, h.tipo);
    const total = body.itens.reduce(
      (acc, it) => acc + Number(it.prunit) * Number(it.qtd),
      0,
    );

    // Buscar UF da empresa no Postgres
    const qUF = await pgClient.query('SELECT uf FROM dadosempresa LIMIT 1');
    const uf = qUF.rowCount ? qUF.rows[0].uf : 'AM';

    const status = initialStatus(h.tipo, h.bloqueada as any, uf);
    log('ids/status/total:', ids, status, total);

    // Normalização e armazém para impressão
    const hPg = normalizeHeaderPg(h);
    const armForPrint = pickArmazem(body.itens);

    // BUSCAR DADOS DA EMPRESA PELO ARMAZÉM (CNPJ e IE para faturamento)
    const empresaData = await getEmpresaDataByArmazem(pgClient, armForPrint);
    log('dados empresa do armazém:', empresaData);

    // CALCULAR IMPOSTOS DOS ITENS
    log('iniciando cálculo de impostos...');
    const itensComImpostos = await calcularImpostosItens(
      pgClient,
      body.itens,
      h.codcli,
      h.tipo,
      log,
    );
    log('cálculo de impostos concluído');

    // POSTGRES
    await insertPgVenda(pgClient, ids, hPg, status, total, empresaData);
    await insertPgItensAndStock(pgClient, ids, itensComImpostos);
    await insertPgPrazos(pgClient, ids.codvenda, body.prazos);
    await insertPgServImp(pgClient, ids, h, total, armForPrint);

    // Promoções (PG)
    const promoDeltas = extractPromoDeltas(itensComImpostos);
    log('promo deltas:', JSON.stringify(Array.from(promoDeltas.entries())));
    await updatePgPromocaoVendido(pgClient, promoDeltas);

    // Se a venda veio de um draft real (não é "atualizar"), exclui da tabela venda_draft
    if (h?.draft_id && h.draft_id !== 'atualizar') {
      await pgClient.query(`DELETE FROM venda_draft WHERE draft_id = $1`, [
        h.draft_id,
      ]);
      log('Draft excluído da tabela venda_draft:', h.draft_id);
    }

    // COMMIT
    await pgClient.query('COMMIT');

    return res.status(200).json({
      ok: true,
      codvenda: ids.codvenda,
      nrovenda: ids.nrovenda,
      status,
      total,
      traceId,
    });
  } catch (e: any) {
    err('falha geral', e);
    try {
      if (pgClient) await pgClient.query('ROLLBACK');
    } catch {}
    return res.status(500).json({
      ok: false,
      error: e?.message || 'Falha ao finalizar venda',
      traceId,
    });
  } finally {
    try {
      if (pgClient) pgClient.release();
    } catch {}
  }
}

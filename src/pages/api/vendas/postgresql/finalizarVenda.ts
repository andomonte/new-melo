import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

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
  nrequis?: string | null;
  nritem?: string | null;
  demanda?: string;
  qtdpnd?: number;
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
    formaPagamento?: string | null;
    parcelasCartao?: number | null;
    avista?: boolean;
    avistaMotivo?: string | null;
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

  // Montar obsfat com forma de pagamento prefixada (mesmo padrão Delphi pObsFat)
  // Delphi: "A VISTA...", "CARTAO DE CREDITO 02x...", "DEPOSITO BANCARIO..."
  // Faturamento checa substr(obsfat,1,17) = 'CARTAO DE CREDITO' e substr(1,8) = 'A VISTA '
  let fp = nul(h.formaPagamento);
  if (fp) {
    const fpUpper = fp.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (fpUpper.includes('CARTAO') && fpUpper.includes('CREDITO')) {
      const parcelas = Number(h.parcelasCartao) || 1;
      fp = `CARTAO DE CREDITO ${String(parcelas).padStart(2, '0')}x`;
    } else {
      // Dinheiro, PIX, Débito, etc → prefixar com A VISTA (motivo)
      const motivo = h.avistaMotivo || 'VE';
      fp = motivo === 'Z' ? `A VISTA (Z) - DINHEIRO` : `A VISTA (${motivo})`;
    }
  } else if (h.avista) {
    const motivo = h.avistaMotivo || 'VE';
    fp = motivo === 'Z' ? `A VISTA (Z) - DINHEIRO` : `A VISTA (${motivo})`;
  }
  const obsOriginal = nul(h.obsfat);
  const obsfatFinal = fp
    ? (obsOriginal ? `${fp} ${obsOriginal}` : fp)
    : obsOriginal;

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
    obsfat: obsfatFinal,
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
  if (blq === 'S' || bloqueada === '1') return 'B';
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
  filialTz: string = 'America/Manaus',
) {
  const DEFAULT_NUMEROSERIE = 'SO PRENOTA TEM NUMERO DE SERIE';

  await client.query(
    `INSERT INTO dbvenda (
       operacao, codvenda, codusr, codvend, nrovenda, codcli, data, total, nronf, pedido,
       status, transp, prazo, obs, tipo_desc, tipo, tele, cancel, statusest, impresso,
       vlrfrete, codtptransp, bloqueada, estoque_virtual, numeroserie, numerocupom,
       obsfat, localentregacliente, statuspedido, dtupdate, cnpj_empresa, ie_empresa
     ) VALUES (
       $1,$2,$3,$4,$5,$6,NOW() AT TIME ZONE '${filialTz}',$7,NULL,$8,
       $9,$10,$11,$12,$13,$14,$15,'N',NULL,'N',
       $16,$17,'0','N',$18,NULL,$19,$20, 1, NOW() AT TIME ZONE '${filialTz}', $21, $22
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

/**
 * Vocabulário de tipo de operação da procedure fiscal (CALCULO_IMPOSTO / calcular_imposto_item).
 * Mantém o MESMO mapeamento do endpoint /api/impostos para que display (venda) = persistência (finalizar).
 */
function mapTipoOperacaoPG(tipo: string): string {
  const t = String(tipo).toUpperCase();
  if (t === '1' || t === '2' || t === 'P' || t.includes('VENDA')) return 'VENDA';
  if (t === 'T' || t.includes('TRANSFERENCIA')) return 'TRANSFERENCIA';
  if (t === 'D' || t.includes('DEVOLUCAO')) return 'DEVOLUCAO_COMPRA';
  if (t === 'B' || t.includes('BONIFICACAO')) return 'REMESSA_BONIFICACAO';
  return 'VENDA';
}

/* ------------------------------------------------
 * Calcula impostos por item via função PostgreSQL calcular_imposto_item
 * (tradução fiel da procedure Oracle CALCULO_IMPOSTO). O SERVIDOR é a fonte única:
 * ignora valores fiscais vindos do front e recalcula no banco, com os MESMOS parâmetros
 * do endpoint /api/impostos → o que a tela mostra é o que é persistido. Sem aritmética em JS.
 * Falha explícita (throw) em vez de fallback silencioso com valores errados.
 * -----------------------------------------------*/
async function calcularImpostosItens(
  client: PoolClient,
  itens: ItemPayload[],
  codcli: string,
  tipoOperacao: string,
  log: (...args: any[]) => void,
): Promise<ItemPayload[]> {
  const tipoOp = mapTipoOperacaoPG(tipoOperacao);
  const num = (v: any) => Number(v ?? 0);
  const itensComImpostos: ItemPayload[] = [];

  log('calculando impostos (PG: calcular_imposto_item) para', itens.length, 'itens | operacao', tipoOp);

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];

    const { rows } = await client.query(
      `SELECT * FROM calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        String(item.codprod).trim().padStart(6, '0'),
        String(codcli).trim(),
        num(item.qtd),
        num(item.prunit),
        'SAIDA',
        tipoOp,
        'NOTA_FISCAL',
        '04',
        'N',
        0,
      ],
    );
    if (!rows.length) {
      throw new Error(
        `Cálculo fiscal: produto ${item.codprod} / cliente ${codcli} não encontrado.`,
      );
    }
    const r = rows[0];

    itensComImpostos.push({
      ...item,
      // ICMS
      icms: num(r.icms), // alíquota %
      baseicms: num(r.baseicms),
      totalicms: num(r.totalicms),
      icmsinterno_dest: num(r.icmsinterno_dest),
      icmsexterno_orig: num(r.icmsexterno_orig),
      csticms: r.csticms ?? '', // CST ICMS via ICMS_CST (FASE 4 P1)
      // ST
      mva: num(r.mva),
      basesubst_trib: num(r.basesubst_trib),
      totalsubst_trib: num(r.totalsubst_trib),
      // IPI
      ipi: num(r.ipi), // alíquota %
      baseipi: num(r.baseipi),
      totalipi: num(r.totalipi),
      cstipi: r.cstipi ?? '',
      // PIS
      pis: num(r.pis), // alíquota %
      basepis: num(r.basepis),
      valorpis: num(r.valorpis),
      cstpis: r.cstpis ?? '',
      // COFINS
      cofins: num(r.cofins), // alíquota %
      basecofins: num(r.basecofins),
      valorcofins: num(r.valorcofins),
      cstcofins: r.cstcofins ?? '',
      // FCP — não computado pela procedure (FASE 4)
      fcp: 0,
      base_fcp: 0,
      valor_fcp: 0,
      fcp_subst: 0,
      basefcp_subst: 0,
      valorfcp_subst: 0,
      // CFOP e NCM
      cfop: r.cfop ?? null,
      tipocfop: '', // procedure não computa
      ncm: r.ncm ?? null,
      // Total produto
      totalproduto: num(r.totalproduto),
      // IBS/CBS (Reforma Tributária — informativo)
      aliquota_ibs: num(r.ibs_e) + num(r.ibs_m),
      aliquota_cbs: num(r.cbs_aliquota),
      valor_ibs: num(r.valor_ibs),
      valor_cbs: num(r.valor_cbs),
      ibs_e: num(r.ibs_e), // IBS Estadual (substitui ICMS)
      ibs_m: num(r.ibs_m), // IBS Municipal (substitui ISS)
    });

    log(
      `item ${i + 1}: PG cfop=${r.cfop} icms=${r.totalicms} st=${r.totalsubst_trib} ipi=${r.totalipi}`,
    );
  }

  return itensComImpostos;
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
         $1,$2,$3,$4,$5,$6,NULL,NULL,
         $7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
         $26,$27,$28,$29,$30,
         $31,$32,$33,$34,$35,$36,
         $37,$38,$39,
         $40,$41,$42,$43,$44,$45,
         $46,$47,$48,$49,
         $50,$51,$52,$53,$54,$55,$56,$57,
         $58,$59,$60,$61,$62,$63
       )`,
      [
        ids.codvenda,
        it.codprod,
        it.prunit,
        it.qtd,
        it.demanda || 'S',
        descr,
        it.codvend ?? null,
        it.codoperador ?? null,
        prcompra,
        prmedio,
        n(it.desconto),
        it.nrequis ?? null,
        it.nritem ?? null,
        it.arm_id,
        ref,
        n(it.icms),              // $15 aliquota_icms = alíquota do ICMS (%)
        n(it.ipi),               // $16 aliquota_ipi = alíquota do IPI (%)
        n(it.totalicms),         // $17 icms = VALOR do ICMS (R$)
        n(it.totalipi),          // $18 ipi = VALOR do IPI (R$)
        n(it.totalipi),          // $19 totalipi (mantido para compatibilidade)
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
        n(it.ibs_e),   // $61 IBS Estadual (substitui ICMS)
        n(it.ibs_m),   // $62 IBS Municipal (substitui ISS)
      ],
    );

    // INSERT pendência se qtdpnd > 0 (como VENDAS.SALVAR_VENDA do Oracle)
    const qtdpnd = Number(it.qtdpnd) || 0;
    if (qtdpnd > 0) {
      await client.query(
        `INSERT INTO dbpend (codvenda, codprod, qtd) VALUES ($1, $2, $3)`,
        [ids.codvenda, it.codprod, qtdpnd],
      );
    }
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

    // IDs + status + total (com acréscimo de cartão se aplicável)
    const ACRESCIMO_CARTAO: Record<number, number> = {
      1: 1.0270, 2: 1.0517, 3: 1.0694, 4: 1.0875, 5: 1.1057,
      6: 1.1246, 7: 1.1434, 8: 1.1620, 9: 1.1800, 10: 1.2000,
    };
    const ids = await nextPgIds(pgClient, h.tipo);
    let total = body.itens.reduce(
      (acc, it) => acc + Number(it.prunit) * Number(it.qtd),
      0,
    );
    // Acréscimo cartão de crédito
    const parcCartao = Number(h.parcelasCartao) || 0;
    if (parcCartao > 0 && ACRESCIMO_CARTAO[parcCartao]) {
      total = Math.round(total * ACRESCIMO_CARTAO[parcCartao] * 100) / 100;
      log('acréscimo cartão', parcCartao, 'x — fator:', ACRESCIMO_CARTAO[parcCartao], '— total ajustado:', total);
    }

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

    // Buscar timezone da filial
    const filialTzResult = await pgClient.query(
      `SELECT timezone FROM tb_filial WHERE nome_filial = $1 LIMIT 1`,
      [filial],
    );
    const filialTz = filialTzResult.rows[0]?.timezone || 'America/Manaus';

    // POSTGRES
    await insertPgVenda(pgClient, ids, hPg, status, total, empresaData, filialTz);
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

    // Incrementar débito do cliente
    await pgClient.query(
      `UPDATE dbclien SET debito = COALESCE(debito, 0) + $1 WHERE codcli = $2`,
      [total, h.codcli],
    );

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

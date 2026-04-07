import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

// Carregamos via require para evitar tipagem do oracledb em TS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const oracledb = require('oracledb');

/* =========================
   Helpers Oracle
   ========================= */
function initOracleClientOnce() {
  try {
    if (!process.env.ORACLE_CLIENT_INITED) {
      oracledb.initOracleClient?.({
        libDir: 'C:\\oracle\\instantclient\\instantclient_23_4',
      });
      process.env.ORACLE_CLIENT_INITED = '1';
    }
  } catch {
    /* ok se já estiver iniciado */
  }
}

async function getOracleConnection(): Promise<any> {
  const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;
  if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
    throw new Error(
      'Variáveis ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING são obrigatórias.',
    );
  }
  return oracledb.getConnection({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString: ORACLE_CONNECT_STRING,
  });
}

async function nextOracleIds(
  conn: any,
  tipo: string,
): Promise<{ codvenda: string; nrovenda: string }> {
  const r1 = await conn.execute(
    `SELECT LPAD(TO_CHAR(NVL(MAX(TO_NUMBER(CODVENDA)),0) + 1), 9, '0') AS NEXT_COD
       FROM DBVENDA`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const nextCod = r1.rows[0].NEXT_COD as string;

  const r2 = await conn.execute(
    `SELECT LPAD(TO_CHAR(NVL(MAX(TO_NUMBER(NROVENDA)),0) + 1), 9, '0') AS NEXT_NRO
       FROM DBVENDA
      WHERE TIPO = :tipo`,
    [tipo],
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const nextNro = r2.rows[0].NEXT_NRO as string;

  return { codvenda: nextCod, nrovenda: nextNro };
}

async function getEmpresaUFOracle(conn: any): Promise<string> {
  const r = await conn.execute(
    `SELECT UF FROM DADOSEMPRESA WHERE ROWNUM = 1`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (r.rows[0]?.UF as string) || 'AM';
}

function initialStatus(
  tipo: string,
  bloquear: string | undefined,
  uf: string,
): string {
  if (bloquear === 'S') return 'B';
  if (tipo === '1' || tipo === '2') return 'F';
  if (uf === 'AM' || uf === 'RO' || uf === 'PE') return 'N';
  if (tipo === 'P') return 'L';
  return '0';
}

/* =========================
   Types
   ========================= */
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

  // --- Fiscais extras (PG) ---
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
  totalproduto?: number | null;
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

  // --- Promoção (para atualizar qtdvendido) ---
  promocao_id?: number | null; // dbpromocao_item.id_promocao
  qtd_promo?: number | null; // quanto da QTD foi promocional
  codgpp?: string | null; // se a promo for por GPP
};

type Prazo = {
  parcela: number; // 1,2,3...
  vencimento: string | Date; // 'YYYY-MM-DD' ou Date
  valor: number; // (não grava aqui; pedido)
};

type Body = {
  header?: {
    operacao?: number;
    codcli: string;
    codusr: string | number;
    pedido?: string;
    tipo: string; // 'P', 'C', '1', '2'...
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
  };
  itens: ItemPayload[];
  prazos?: Prazo[];
};

/* =========================
   Inserts Oracle
   ========================= */
async function insertOracleVenda(
  conn: any,
  ids: { codvenda: string; nrovenda: string },
  h: NonNullable<Body['header']>,
  status: string,
  total: number,
) {
  await conn.execute(
    `INSERT INTO DBVENDA (
       CODVENDA, NROVENDA, DATA, TOTAL, OBS, OBSFAT, CODCLI, TIPO, CANCEL, NRONF,
       PEDIDO, STATUS, TELE, TIPO_DESC, TRANSP, PRAZO, CODUSR, STATUSEST,
       VLRFRETE, CODTPTRANSP, BLOQUEADA, ESTOQUE_VIRTUAL, OPERACAO, LOCALENTREGACLIENTE
     ) VALUES (
       :CODVENDA, :NROVENDA, TRUNC(SYSDATE), :TOTAL, :OBS, :OBSFAT, :CODCLI, :TIPO, 'N', :NRONF,
       :PEDIDO, :STATUS, :TELE, :TIPO_DESC, :TRANSP, :PRAZO, :CODUSR, 'N',
       :VLRFRETE, :CODTPTRANSP, '0', 'N', :OPERACAO, :LOCALENTREGA
     )`,
    {
      CODVENDA: ids.codvenda,
      NROVENDA: ids.nrovenda,
      TOTAL: total,
      OBS: h.obs ?? null,
      OBSFAT: h.obsfat ?? null,
      CODCLI: h.codcli,
      TIPO: h.tipo,
      NRONF: null,
      PEDIDO: h.pedido ?? null,
      STATUS: status,
      TELE: h.tele ?? 'N',
      TIPO_DESC: h.tipo_desc ?? null,
      TRANSP: h.transp ?? null,
      PRAZO: h.prazo ?? null,
      CODUSR: String(h.codusr),
      VLRFRETE: h.vlrfrete ?? 0,
      CODTPTRANSP: h.codtptransp ?? null,
      OPERACAO: h.operacao ?? null,
      LOCALENTREGA: h.localentregacliente ?? null,
    },
    { autoCommit: false },
  );

  if (h.vendedor) {
    await conn.execute(
      `INSERT INTO DBVVEND (CODVEND, CODVENDA, OPERADOR) VALUES (:CODVEND, :CODVENDA, 'N')`,
      { CODVEND: h.vendedor, CODVENDA: ids.codvenda },
      { autoCommit: false },
    );
  }
  if (h.tele === 'S' && h.operador) {
    await conn.execute(
      `INSERT INTO DBVVEND (CODVEND, CODVENDA, OPERADOR) VALUES (:CODVEND, :CODVENDA, 'S')`,
      { CODVEND: h.operador, CODVENDA: ids.codvenda },
      { autoCommit: false },
    );
  }
}

async function insertOracleItensAndStock(
  conn: any,
  ids: { codvenda: string },
  itens: ItemPayload[],
) {
  for (const it of itens) {
    if (!it.codprod || !it.qtd || !it.prunit || !it.arm_id) {
      throw new Error(
        `Item inválido (codprod/qtd/prunit/arm_id obrigatórios).`,
      );
    }

    // saldo por armazém
    const stock = await conn.execute(
      `SELECT (ARP_QTEST - ARP_QTEST_RESERVADA) AS DISPONIVEL, ARM.ARM_DESCRICAO AS ARMAZEM
         FROM CAD_ARMAZEM_PRODUTO ARP
         JOIN CAD_ARMAZEM ARM ON ARM.ARM_ID = ARP.ARP_ARM_ID
        WHERE ARP.ARP_CODPROD = :CODPROD AND ARP.ARP_ARM_ID = :ARM`,
      { CODPROD: it.codprod, ARM: it.arm_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const disponivel = Number(stock.rows?.[0]?.DISPONIVEL ?? 0);
    const armNome = (stock.rows?.[0]?.ARMAZEM as string) || '';
    if (it.qtd > disponivel) {
      throw new Error(
        `ESTOQUE INSUFICIENTE - REF: ${
          it.ref ?? it.codprod
        } | ARMAZEM: ${armNome}`,
      );
    }

    // pega dados de custo/médio
    const p = await conn.execute(
      `SELECT DESCR, REF, PRCOMPRA, PRMEDIO, DOLAR, TXDOLARCOMPRA FROM DBPROD WHERE CODPROD = :CODPROD`,
      { CODPROD: it.codprod },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const prow = p.rows?.[0] || {};
    const descr = it.descr ?? (prow.DESCR as string) ?? '';
    const ref = it.ref ?? (prow.REF as string) ?? null;
    const dolar = (prow.DOLAR as string) === 'S';
    const txdolar = Number(prow.TXDOLARCOMPRA ?? 1);
    const prcompra = Number(prow.PRCOMPRA ?? 0) * (dolar ? txdolar : 1);
    const prmedio = Number(prow.PRMEDIO ?? 0) * (dolar ? txdolar : 1);

    await conn.execute(
      `INSERT INTO DBITVENDA (
         CODVENDA, CODPROD, PRUNIT, QTD, DEMANDA, DESCR, COMISSAO, ORIGEMCOM,
         CODVEND, CODOPERADOR, PRCOMPRA, PRMEDIO, DESCONTO, NREQUI, NRITEM, ARM_ID, REF
       ) VALUES (
         :CODVENDA, :CODPROD, :PRUNIT, :QTD, 'S', :DESCR, NULL, NULL,
         NULL, NULL, :PRCOMPRA, :PRMEDIO, :DESCONTO, NULL, :NRITEM, :ARM, :REF
       )`,
      {
        CODVENDA: ids.codvenda,
        CODPROD: it.codprod,
        PRUNIT: it.prunit,
        QTD: it.qtd,
        DESCR: descr,
        PRCOMPRA: prcompra,
        PRMEDIO: prmedio,
        DESCONTO: it.desconto ?? 0,
        NRITEM: it.nritem ?? null,
        ARM: it.arm_id,
        REF: ref,
      },
      { autoCommit: false },
    );

    // RESERVA DE ESTOQUE: Ao finalizar a venda, apenas reservamos o estoque
    // incrementando ARP_QTEST_RESERVADA. O estoque físico só será
    // decrementado no momento do faturamento.
    await conn.execute(
      `UPDATE CAD_ARMAZEM_PRODUTO
          SET ARP_QTEST_RESERVADA = NVL(ARP_QTEST_RESERVADA, 0) + :QTD
        WHERE ARP_CODPROD = :CODPROD AND ARP_ARM_ID = :ARM`,
      { QTD: it.qtd, CODPROD: it.codprod, ARM: it.arm_id },
      { autoCommit: false },
    );
    // NOTA: Não atualizamos DBPROD.QTEST aqui porque estamos apenas reservando.
    // O estoque total só será decrementado no faturamento.
  }
}

/* =========================
   Inserts PostgreSQL
   ========================= */
async function insertPgVenda(
  client: PoolClient,
  schema: string,
  ids: { codvenda: string; nrovenda: string },
  h: NonNullable<Body['header']>,
  status: string,
  total: number,
) {
  await client.query(
    `INSERT INTO ${schema}.dbvenda (
       operacao, codvenda, codusr, nrovenda, codcli, data, total, nronf, pedido,
       status, transp, prazo, obs, tipo_desc, tipo, tele, cancel, statusest, impresso,
       vlrfrete, codtptransp, bloqueada, estoque_virtual, numeroserie, numerocupom,
       obsfat, localentregacliente
     ) VALUES (
       $1,$2,$3,$4,$5,CURRENT_DATE,$6,NULL,$7,
       $8,$9,$10,$11,$12,$13,$14,'N','N',NULL,
       $15,$16,'0','N',NULL,NULL,
       $17,$18
     )`,
    [
      h.operacao ?? null,
      ids.codvenda,
      String(h.codusr),
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
      h.vlrfrete ?? 0,
      h.codtptransp ?? null,
      h.obsfat ?? null,
      h.localentregacliente ?? null,
    ],
  );

  if (h.vendedor) {
    await client.query(
      `INSERT INTO ${schema}.dbvvend (codvend, codvenda, operador) VALUES ($1,$2,'N')`,
      [h.vendedor, ids.codvenda],
    );
  }
  if (h.tele === 'S' && h.operador) {
    await client.query(
      `INSERT INTO ${schema}.dbvvend (codvend, codvenda, operador) VALUES ($1,$2,'S')`,
      [h.operador, ids.codvenda],
    );
  }
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

async function insertPgItensAndStock(
  client: PoolClient,
  schema: string,
  ids: { codvenda: string },
  itens: ItemPayload[],
) {
  for (const it of itens) {
    if (!it.codprod || !it.qtd || !it.prunit || !it.arm_id) {
      throw new Error(
        `Item inválido (codprod/qtd/prunit/arm_id obrigatórios).`,
      );
    }

    // saldo por armazém
    const r = await client.query(
      `SELECT (arp_qtest - arp_qtest_reservada) AS disponivel, arm.arm_descricao AS armazem
         FROM ${schema}.cad_armazem_produto arp
         JOIN ${schema}.cad_armazem arm ON arm.arm_id = arp.arp_arm_id
        WHERE arp.arp_codprod = $1 AND arp.arp_arm_id = $2`,
      [it.codprod, it.arm_id],
    );
    const disponivel = Number(r.rows?.[0]?.disponivel ?? 0);
    const armNome = (r.rows?.[0]?.armazem as string) || '';
    if (it.qtd > disponivel) {
      throw new Error(
        `ESTOQUE INSUFICIENTE - REF: ${
          it.ref ?? it.codprod
        } | ARMAZEM: ${armNome}`,
      );
    }

    // custo/médio para gravar (mantemos como no Oracle)
    const p = await client.query(
      `SELECT descr, ref, prcompra, prmedio, dolar, txdolarcompra
         FROM ${schema}.dbprod WHERE codprod = $1`,
      [it.codprod],
    );
    const prow = p.rows?.[0] || {};
    const descr = it.descr ?? (prow.descr as string) ?? '';
    const ref = it.ref ?? (prow.ref as string) ?? null;
    const dolar = (prow.dolar as string) === 'S';
    const txdolar = Number(prow.txdolarcompra ?? 1);
    const prcompra = Number(prow.prcompra ?? 0) * (dolar ? txdolar : 1);
    const prmedio = Number(prow.prmedio ?? 0) * (dolar ? txdolar : 1);

    // INSERT item com campos fiscais extras
    await client.query(
      `INSERT INTO ${schema}.dbitvenda (
         codvenda, codprod, prunit, qtd, demanda, descr, comissao, origemcom,
         codvend, codoperador, prcompra, prmedio, desconto, nrequis, nritem, arm_id, ref,
         icms, ipi, totalipi, baseicms, totalicms, mva, basesubst_trib, totalsubst_trib,
         baseipi, icmsinterno_dest, icmsexterno_orig, totalproduto, totalicmsdesconto,
         pis, cofins, basepis, valorpis, basecofins, valorcofins,
         fretebase, acrescimo, freteicms,
         fcp, base_fcp, valor_fcp, fcp_subst, basefcp_subst, valorfcp_subst,
         ftp_st, fcp_substret, basefcp_substret, valorfcp_substret,
         codint, cfop, tipocfop, ncm, cstipi, cstpis, cstcofins, csticms
       ) VALUES (
         $1,$2,$3,$4,'S',$5,NULL,NULL,
         $6,$7,$8,$9,$10,NULL,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,
         $22,$23,$24,$25,$26,
         $27,$28,$29,$30,$31,$32,
         $33,$34,$35,
         $36,$37,$38,$39,$40,$41,
         $42,$43,$44,$45,
         $46,$47,$48,$49,$50,$51,$52,$53
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

        n(it.icms),
        n(it.ipi),
        n(it.totalipi),
        n(it.baseicms),
        n(it.totalicms),
        n(it.mva),
        n(it.basesubst_trib),
        n(it.totalsubst_trib),
        n(it.baseipi),
        n(it.icmsinterno_dest),
        n(it.icmsexterno_orig),
        n(it.totalproduto),
        n(it.totalicmsdesconto),
        n(it.pis),
        n(it.cofins),
        n(it.basepis),
        n(it.valorpis),
        n(it.basecofins),
        n(it.valorcofins),
        n(it.fretebase),
        n(it.acrescimo),
        n(it.freteicms),
        n(it.fcp),
        n(it.base_fcp),
        n(it.valor_fcp),
        n(it.fcp_subst),
        n(it.basefcp_subst),
        n(it.valorfcp_subst),
        n(it.ftp_st),
        n(it.fcp_substret),
        n(it.basefcp_substret),
        n(it.valorfcp_substret),
        it.codint ?? null,
        it.cfop ?? null,
        it.tipocfop ?? null,
        it.ncm ?? null,
        it.cstipi ?? null,
        it.cstpis ?? null,
        it.cstcofins ?? null,
        it.csticms ?? null,
      ],
    );

    // RESERVA DE ESTOQUE: Ao finalizar a venda, apenas reservamos o estoque
    // incrementando arp_qtest_reservada. O estoque físico só será
    // decrementado no momento do faturamento.
    await client.query(
      `UPDATE ${schema}.cad_armazem_produto
          SET arp_qtest_reservada = COALESCE(arp_qtest_reservada, 0) + $1
        WHERE arp_codprod = $2 AND arp_arm_id = $3`,
      [it.qtd, it.codprod, it.arm_id],
    );
    // NOTA: Não atualizamos dbprod.qtest aqui porque estamos apenas reservando.
    // O estoque total só será decrementado no faturamento.
  }
}

/* =========================
   Novos helpers PG (Promo + Prazos)
   ========================= */
async function updatePgPromocaoQtdVendido(
  client: PoolClient,
  schema: string,
  itens: ItemPayload[],
) {
  // agrega por (id_promocao + codprod) OU (id_promocao + codgpp)
  const acumulado = new Map<
    string,
    { id: number; codprod?: string; codgpp?: string; qtd: number }
  >();

  for (const it of itens) {
    const id = Number(it.promocao_id ?? 0);
    const qtd = Number(it.qtd_promo ?? 0);
    if (!id || !qtd) continue;

    const chave = it.codprod
      ? `${id}|prod|${it.codprod}`
      : it.codgpp
      ? `${id}|gpp|${it.codgpp}`
      : '';

    if (!chave) continue;

    const cur = acumulado.get(chave);
    if (!cur) {
      acumulado.set(chave, {
        id,
        codprod: it.codprod ?? undefined,
        codgpp: it.codgpp ?? undefined,
        qtd,
      });
    } else {
      cur.qtd += qtd;
    }
  }

  for (const { id, codprod, codgpp, qtd } of acumulado.values()) {
    if (qtd <= 0) continue;

    if (codprod) {
      await client.query(
        `UPDATE ${schema}.dbpromocao_item
            SET qtdvendido = COALESCE(qtdvendido,0) + $1
          WHERE id_promocao = $2
            AND codprod = $3`,
        [qtd, id, codprod],
      );
    } else if (codgpp) {
      await client.query(
        `UPDATE ${schema}.dbpromocao_item
            SET qtdvendido = COALESCE(qtdvendido,0) + $1
          WHERE id_promocao = $2
            AND codgpp = $3`,
        [qtd, id, codgpp],
      );
    }
  }
}

async function insertPgPrazosPagamento(
  client: PoolClient,
  schema: string,
  codvenda: string,
  prazos: Prazo[] | undefined,
) {
  if (!prazos || prazos.length === 0) return;

  for (const p of prazos) {
    const dataVenc =
      p.vencimento instanceof Date ? p.vencimento : new Date(p.vencimento);

    // Se preferir guardar o "dia do mês", troque para: const dia = dataVenc.getDate();
    const dia = p.parcela;

    await client.query(
      `INSERT INTO ${schema}.dbprazo_pagamento (data, dia, codvenda)
       VALUES ($1,$2,$3)`,
      [dataVenc, dia, codvenda],
    );
  }
}

/* =========================
   Handler
   ========================= */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  const schema = 'db_manaus';

  const body = req.body as Body;
  const h = body.header ?? ({} as NonNullable<Body['header']>);

  // validação mínima
  if (
    !h.codusr ||
    !h.codcli ||
    !h.tipo ||
    !Array.isArray(body.itens) ||
    body.itens.length === 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        'Campos obrigatórios: header.codusr, header.codcli, header.tipo e itens[].',
    });
  }

  initOracleClientOnce();

  let oraConn: any;
  let pgClient: PoolClient | undefined;

  try {
    // conecta
    oraConn = await getOracleConnection();
    const pgPool = getPgPool(filial);
    pgClient = await pgPool.connect();

    // inicia transações
    await oraConn.execute('SAVEPOINT SP_START');
    await pgClient.query('BEGIN');

    // ids no Oracle e status (igual legado)
    const uf = await getEmpresaUFOracle(oraConn);
    const ids = await nextOracleIds(oraConn, h.tipo);
    const total = body.itens.reduce(
      (acc, it) => acc + Number(it.prunit) * Number(it.qtd),
      0,
    );
    const status = initialStatus(h.tipo, h.bloqueada, uf);

    // Oracle
    await insertOracleVenda(oraConn, ids, h, status, total);
    await insertOracleItensAndStock(oraConn, ids, body.itens);

    // PG
    await insertPgVenda(pgClient, schema, ids, h, status, total);
    await insertPgItensAndStock(pgClient, schema, ids, body.itens);

    // ++ NOVO: atualiza vendidos da promoção (se veio promoção_id + qtd_promo)
    await updatePgPromocaoQtdVendido(pgClient, schema, body.itens);

    // ++ NOVO: grava prazos em dbprazo_pagamento
    await insertPgPrazosPagamento(pgClient, schema, ids.codvenda, body.prazos);

    // commit
    await pgClient.query('COMMIT');
    await oraConn.commit();

    return res.status(200).json({
      ok: true,
      codvenda: ids.codvenda,
      nrovenda: ids.nrovenda,
      status,
      total,
    });
  } catch (e: any) {
    // rollback nos dois
    try {
      if (pgClient) await pgClient.query('ROLLBACK');
    } catch {}
    try {
      if (oraConn) await oraConn.rollback();
    } catch {}

    return res.status(500).json({
      ok: false,
      error: e?.message || 'Falha ao finalizar venda',
    });
  } finally {
    try {
      if (pgClient) pgClient.release();
    } catch {}
    try {
      if (oraConn) await oraConn.close();
    } catch {}
  }
}

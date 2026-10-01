import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(val: any): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('pt-BR');
}

function fmtMoney(val: any): string {
  const n = parseFloat(val ?? 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneyNum(val: any): number {
  return parseFloat(parseFloat(val ?? 0).toFixed(2));
}

// Group rows by cliente name
function groupByCliente(rows: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.cliente ?? 'SEM CLIENTE';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  // Sort keys ascending
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return new Map(sorted);
}

// Agrupa por dia de vencimento — é o que o GeraRxReceberPeriodo do Delphi faz
// (cabeçalho "DIA: dd/mm/aaaa", subtotal "TOTAL DIA" e "TOTAL GERAL" no fim).
function groupByDia(rows: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.dt_venc ? String(row.dt_venc).slice(0, 10) : 'SEM VENCIMENTO';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return new Map(Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])));
}

// ─── Colunas do relatório (selecionáveis + reordenáveis) ─────────────────────
type ColTipo = 'text' | 'money' | 'date' | 'num';
export const COLS_REL: Record<string, { label: string; tipo: ColTipo; campo: string }> = {
  nro_doc:      { label: 'NRO_DOC',      tipo: 'text',  campo: 'nro_doc' },
  dias:         { label: 'DIAS',         tipo: 'num',   campo: 'dias' },
  cliente:      { label: 'CLIENTE',      tipo: 'text',  campo: 'cliente' },
  cod_conta:    { label: 'COD_CONTA',    tipo: 'text',  campo: 'cod_conta' },
  valor_pgto:   { label: 'VALOR_PGTO',   tipo: 'money', campo: 'valor_pgto' },
  valor_juros:  { label: 'VALOR_JUROS',  tipo: 'money', campo: 'valor_juros' },
  valor_rec:    { label: 'VALOR_REC',    tipo: 'money', campo: 'valor_rec' },
  valor_aberto: { label: 'VALOR_ABERTO', tipo: 'money', campo: 'valor_aberto' },
  dt_emissao:   { label: 'DT_EMISSAO',   tipo: 'date',  campo: 'dt_emissao' },
  dt_venc:      { label: 'DT_VENC',      tipo: 'date',  campo: 'dt_venc' },
  parcela:      { label: 'PARCELA',      tipo: 'text',  campo: 'parcela' },
  tarifa:       { label: 'TARIFA',       tipo: 'money', campo: 'tarifa' },
  dt_pgto:      { label: 'DT_PGTO',      tipo: 'date',  campo: 'dt_pgto' },
};
export const COLS_ORDER_DEFAULT = Object.keys(COLS_REL);

/** Lê o parâmetro `colunas` (chaves separadas por vírgula, na ordem) ou usa o padrão. */
function parseColunas(param?: string): string[] {
  if (!param) return COLS_ORDER_DEFAULT;
  const lista = param.split(',').map((s) => s.trim()).filter((k) => COLS_REL[k]);
  return lista.length > 0 ? lista : COLS_ORDER_DEFAULT;
}

// ─── SQL ────────────────────────────────────────────────────────────────────

// Configuração dos relatórios do Delphi (Financeiro → Contas a Receber → Relatórios).
// layout: 'geral' (lista) ou 'por_cliente' (agrupado). fonte: dbreceb (títulos) ou dbfreceb (recebimentos).
export const TIPO_CONFIG: Record<
  string,
  { layout: 'geral' | 'por_cliente' | 'por_dia'; titulo: string; extraWhere: string; dateField: string; fonte: 'dbreceb' | 'dbfreceb' }
> = {
  geral:                { layout: 'geral',       titulo: 'RELATÓRIO DE CONTAS A RECEBER', extraWhere: '',                                                            dateField: 'dt_venc',    fonte: 'dbreceb' },
  // Oracle (CONTASR.DADOS_RECEBIMENTO): "Where r.cancel='N' and r.rec='N'".
  por_cliente:          { layout: 'por_cliente', titulo: 'CONTAS A RECEBER POR CLIENTE',  extraWhere: ` AND r.rec IS DISTINCT FROM 'S'`,                              dateField: 'dt_venc',    fonte: 'dbreceb' },
  receber_periodo:      { layout: 'por_dia',     titulo: 'RECEBER NO PERÍODO',            extraWhere: ` AND r.rec IS DISTINCT FROM 'S'`,                              dateField: 'dt_venc',    fonte: 'dbreceb' },
  em_atraso:            { layout: 'geral',       titulo: 'TÍTULOS EM ATRASO NO PERÍODO',  extraWhere: ` AND r.rec IS DISTINCT FROM 'S' AND r.dt_venc < CURRENT_DATE`,  dateField: 'dt_venc',    fonte: 'dbreceb' },
  // Critério do Oracle (PRERECEB.CONSULTA_AVISTA_DIARIO): "à vista" é o título
  // cujo VENCIMENTO É IGUAL À EMISSÃO, com fatura de tipo 1 ou 3 — não tem nada
  // a ver com dbclien.claspgto, que é a classe de pagamento do cliente.
  //
  // Desvio deliberado no tipofat: lá o INNER JOIN com dbfatura descarta quem não
  // tem fatura; aqui a dbfatura só tem as faturas emitidas pelo próprio web
  // (2.153 linhas contra 1,98 mi de títulos — o histórico não foi migrado), e o
  // join literal zeraria o relatório. Então excluímos apenas quem TEM fatura de
  // outro tipo. Quando a dbfatura estiver completa, basta trocar o NOT EXISTS
  // (tipofat NOT IN) por EXISTS (tipofat IN) para ficar idêntico ao Oracle.
  diario_avista:        { layout: 'geral',       titulo: 'TÍTULOS DIÁRIO À VISTA',        extraWhere: ` AND r.cancel = 'N' AND r.dt_venc = r.dt_emissao AND NOT EXISTS (SELECT 1 FROM dbfatura f WHERE ((r.cod_fat = f.codfat AND f.codgp IS NULL) OR (r.codgp = f.codgp AND f.codfat IS NULL)) AND f.tipofat NOT IN ('1','3'))`,                                                            dateField: 'dt_emissao', fonte: 'dbreceb' },
  // CONTASR.CONSULTA_RECEBIMENTO_CLIENTE: filtra por p.dt_emissao (a data do
  // lançamento do recebimento), com r.cancel='N' e p.SF<>'C'.
  recebimento_clientes: { layout: 'geral',       titulo: 'RECEBIMENTO DE CLIENTES',       extraWhere: ` AND r.cancel = 'N' AND COALESCE(fr.sf, '') <> 'C'`,            dateField: 'dt_emissao', fonte: 'dbfreceb' },
};

function buildQuery(
  tipo: string,
  data_inicio?: string,
  data_fim?: string,
  status?: string,
  colFiltros: { cod_receb?: string; cliente?: string; nro_doc?: string; cod_fat?: string; search?: string } = {},
  extra: {
    codcli?: string;
    cod_conta?: string;
    classe_pgto?: string;
    tx_juros?: string;
    codvend?: string;
    uf?: string;
    rec_filtro?: string; // 'S' = pago, 'N' = não pago (diário à vista)
    orgaos?: string; // 'S' = só órgãos públicos (claspgto='O')
    /** "Com juros até" (dtpJuros do Delphi → vDia). Vazio = hoje. */
    dia_juros?: string;
    /** Tarifa bancária por título (meCli_TarifaBanc do Delphi). */
    tarifa?: string;
  } = {},
): { sql: string; params: any[]; countSql: string; layout: 'geral' | 'por_cliente' | 'por_dia'; titulo: string } {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.geral;
  const params: any[] = [];
  let idx = 1;
  let whereClause = '';
  // Taxa de juros (número seguro — interpolada direto no SQL do juros projetado).
  const tx = Number(String(extra.tx_juros ?? '').replace(',', '.')) || 0;
  // Tarifa bancária por título. No Delphi é o meCli_TarifaBanc: entra na coluna
  // TARIFA e soma no valor em aberto de cada título.
  const tarifa = Number(String(extra.tarifa ?? '').replace(',', '.')) || 0;
  // Data-base do juros. No Delphi é o vDia do RELATO.RECEBER: a aba "Receber do
  // Cliente" manda a data do campo "Com juros até"; a do período manda hoje.
  const diaJuros = /^\d{4}-\d{2}-\d{2}$/.test(String(extra.dia_juros ?? ''))
    ? `DATE '${extra.dia_juros}'`
    : 'CURRENT_DATE';

  // Período: dbreceb usa r.<campo> (dt_venc/dt_emissao); dbfreceb usa fr.dt_pgto.
  const campoData = cfg.fonte === 'dbfreceb' ? `fr.${cfg.dateField}` : `r.${cfg.dateField}`;
  if (data_inicio) {
    whereClause += ` AND ${campoData} >= $${idx++}`;
    params.push(data_inicio);
  }
  if (data_fim) {
    whereClause += ` AND ${campoData} <= $${idx++}`;
    params.push(data_fim);
  }

  // Filtros de coluna vindos da tela (refletem o filtro rápido)
  if (colFiltros.cod_receb) {
    whereClause += ` AND CAST(r.cod_receb AS TEXT) ILIKE $${idx}`;
    params.push(`%${colFiltros.cod_receb}%`); idx++;
  }
  if (colFiltros.nro_doc) {
    whereClause += ` AND r.nro_doc ILIKE $${idx}`;
    params.push(`%${colFiltros.nro_doc}%`); idx++;
  }
  if (colFiltros.cliente) {
    whereClause += ` AND (c.nome ILIKE $${idx} OR CAST(c.codcli AS TEXT) ILIKE $${idx})`;
    params.push(`%${colFiltros.cliente}%`); idx++;
  }
  if (colFiltros.cod_fat) {
    whereClause += ` AND r.cod_fat ILIKE $${idx}`;
    params.push(`%${colFiltros.cod_fat}%`); idx++;
  }
  // Busca geral (mesmos campos da listagem)
  if (colFiltros.search) {
    whereClause += ` AND (CAST(r.cod_receb AS TEXT) ILIKE $${idx} OR c.nome ILIKE $${idx} OR r.nro_doc ILIKE $${idx})`;
    params.push(`%${colFiltros.search}%`); idx++;
  }

  // Parâmetros próprios do relatório (Delphi TFrmRelContasR): cliente, conta, classe pgto.
  if (extra.codcli) {
    whereClause += ` AND LTRIM(CAST(r.codcli AS TEXT), '0') = LTRIM($${idx}, '0')`;
    params.push(String(extra.codcli)); idx++;
  }
  if (extra.cod_conta) {
    const contaCol = cfg.fonte === 'dbfreceb' ? 'fr.cod_conta' : 'r.cod_conta';
    whereClause += ` AND ${contaCol} = $${idx}`;
    params.push(String(extra.cod_conta)); idx++;
  }
  // Classe de pagamento (dbclien.claspgto). Valores reais no banco (mapeamento Delphi):
  //   I = À VISTA · V = INATIVO · A/B/C = classes · O = ÓRGÃOS PÚBLICOS · 'T' = todos.
  if (extra.classe_pgto && extra.classe_pgto !== 'T') {
    whereClause += ` AND UPPER(COALESCE(c.claspgto,'')) = $${idx}`;
    params.push(String(extra.classe_pgto).toUpperCase()); idx++;
  }
  // Vendedor do cliente (Em atraso → escopo Vendedor).
  if (extra.codvend) {
    whereClause += ` AND LTRIM(CAST(c.codvend AS TEXT), '0') = LTRIM($${idx}, '0')`;
    params.push(String(extra.codvend)); idx++;
  }
  // Órgãos públicos (Em atraso → escopo Órgãos): claspgto='O'.
  if (extra.orgaos === 'S') {
    // CONTASR.DADOS_RECEBIMENTO, tipo 'OP': "and c.codcc in ('00005','00006','00007')".
    // É a classe de cliente (codcc), não o claspgto.
    whereClause += ` AND c.codcc IN ('00005','00006','00007')`;
  }
  // UF do cliente (Títulos Diário à Vista).
  if (extra.uf) {
    whereClause += ` AND UPPER(COALESCE(c.uf,'')) = $${idx}`;
    params.push(String(extra.uf).toUpperCase()); idx++;
  }
  // Pago / Não pago (Títulos Diário à Vista → dbreceb.rec).
  if (cfg.fonte === 'dbreceb' && (extra.rec_filtro === 'S' || extra.rec_filtro === 'N')) {
    whereClause += extra.rec_filtro === 'S' ? ` AND r.rec = 'S'` : ` AND r.rec IS DISTINCT FROM 'S'`;
  }

  // Filtro específico do tipo de relatório.
  whereClause += cfg.extraWhere;

  // ── Fonte dbfreceb: "Recebimento de Clientes" (o que foi recebido no período) ──
  if (cfg.fonte === 'dbfreceb') {
    const sqlFr = `
      SELECT
        fr.cod_receb,
        r.nro_doc,
        '' AS parcela,
        0 AS dias,
        COALESCE(c.codcli::text, '') || ' ' || COALESCE(c.nome, '') AS cliente,
        fr.cod_conta,
        0 AS valor_pgto,
        CASE WHEN fr.tipo = 'J' THEN COALESCE(fr.valor,0) ELSE 0 END AS valor_juros,
        COALESCE(fr.valor, 0) AS valor_rec,
        0 AS valor_aberto,
        r.dt_emissao,
        r.dt_venc,
        0 AS tarifa,
        fr.dt_pgto
      FROM dbfreceb fr
      JOIN dbreceb r ON r.cod_receb = fr.cod_receb
      LEFT JOIN dbclien c ON c.codcli = r.codcli
      WHERE 1=1 ${whereClause}
      ORDER BY fr.dt_emissao ASC, cliente ASC, r.nro_doc ASC
    `;
    const countFr = `
      SELECT COUNT(*) AS total
      FROM dbfreceb fr
      JOIN dbreceb r ON r.cod_receb = fr.cod_receb
      LEFT JOIN dbclien c ON c.codcli = r.codcli
      WHERE 1=1 ${whereClause}
    `;
    return { sql: sqlFr, params, countSql: countFr, layout: cfg.layout, titulo: cfg.titulo };
  }

  // Determinar filtro de status após CTE
  let statusFilter = '';
  if (status && status !== 'todos') {
    if (status === 'pendente_parcial') {
      statusFilter = `AND calc_status IN ('pendente', 'recebido_parcial')`;
    } else {
      statusFilter = `AND calc_status = '${status.replace(/'/g, "''")}'`;
    }
  }

  // Por padrão oculta cancelados
  const ocultarCancelados = !status || status !== 'cancelado';
  if (ocultarCancelados) {
    whereClause += ` AND r.cancel != 'S'`;
  }

  // No Oracle o cursor sai ordenado por nome do cliente e o Delphi quebra o dia
  // quando a data muda entre linhas vizinhas — o que só funciona se vier por
  // data. Aqui ordenamos por vencimento, que é o que a tela dele quer mostrar.
  const orderBy = cfg.layout === 'por_dia'
    ? 'dt_venc ASC, cliente ASC, nro_doc ASC'
    : 'cliente ASC, dt_venc ASC';

  const sql = `
    WITH base AS (
      SELECT
        r.cod_receb,
        r.nro_doc,
        CASE
          WHEN r.nro_doc LIKE '%/%' AND split_part(r.nro_doc, '/', 2) ~ '^[0-9]+$' THEN
            (split_part(r.nro_doc, '/', 2)::int)::text || ' de ' ||
            (SELECT COUNT(*) FROM dbreceb rr WHERE rr.nro_doc LIKE split_part(r.nro_doc, '/', 1) || '/%')::text
          ELSE ''
        END AS parcela,
        -- "Atraso" do grid: no Oracle é o campo datraso, simples (data-base − vencimento).
        GREATEST(0, CAST(${diaJuros} AS DATE) - CAST(r.dt_venc AS DATE)) AS dias,
        COALESCE(c.codcli::text, '') || ' ' || COALESCE(c.nome, '') AS cliente,
        r.cod_conta,
        COALESCE(r.valor_pgto, 0) AS valor_pgto,
        -- Juros: porte de CAIXA.CALULAR_JUROS(doc, taxa, diasAtraso) do Oracle.
        --   principal   = valor_pgto − max(0, valor_rec − juros já recebidos)
        --   juros       = (taxa/3000) × (principal + juros em aberto) × diasAtraso
        --   resultado   = max(0, round(juros,2)) + juros em aberto
        -- Antes o web calculava sobre o valor_pgto cheio, ignorando recebimento
        -- parcial e juros já lançados.
        GREATEST(0, ROUND(
          (${tx}/3000.0)
          * ((COALESCE(r.valor_pgto, 0) - GREATEST(0, COALESCE(r.valor_rec, 0) - jr.recebido))
             + jr.aberto)
          * jt.dias_juros, 2)) + jr.aberto AS valor_juros,
        COALESCE(r.valor_rec, 0) AS valor_rec,
        -- ValorReceber do Oracle (+ tarifa bancária, como faz a tela do Delphi).
        ROUND(
          COALESCE(r.valor_pgto, 0) - (COALESCE(r.valor_rec, 0) - jr.recebido)
          + GREATEST(0, ROUND(
              (${tx}/3000.0)
              * ((COALESCE(r.valor_pgto, 0) - GREATEST(0, COALESCE(r.valor_rec, 0) - jr.recebido))
                 + jr.aberto)
              * jt.dias_juros, 2)) + jr.aberto
          + ${tarifa}, 2) AS valor_aberto,
        r.dt_emissao,
        r.dt_venc,
        ${tarifa}::numeric AS tarifa,
        r.dt_pgto,
        CASE
          WHEN r.cancel = 'S' THEN 'cancelado'
          WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
          WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
          WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
          ELSE 'pendente'
        END AS calc_status
      FROM dbreceb r
      LEFT JOIN dbclien c ON c.codcli = r.codcli
      LEFT JOIN cad_conta_financeira cf ON cf.cof_id = r.rec_cof_id
      -- CAIXA.JUROS_RECEBIDO e CAIXA.JUROS_ABERTO do Oracle.
      LEFT JOIN LATERAL (
        SELECT
          COALESCE((
            SELECT SUM(fr.valor) FROM dbfreceb fr
            WHERE fr.cod_receb = r.cod_receb
              AND fr.tipo IN ('18','20','21','22','23','25','26')
              AND COALESCE(fr.sf, '') <> 'C'
          ), 0) AS recebido,
          COALESCE((
            SELECT GREATEST(0, COALESCE(cj.rcj_juros, 0) - COALESCE(cj.rcj_juros_recebido, 0))
            FROM fin_receb_controle_juros cj
            WHERE cj.rcj_cod_receb = r.cod_receb
            ORDER BY cj.rcj_data DESC
            LIMIT 1
          ), 0) AS aberto
      ) jr ON TRUE
      -- diasAtraso do Oracle: só conta a partir de
      -- fluxocxx3.RETORNA_DIA_ATRASO(dt_venc,0,0) — o primeiro dia útil a partir
      -- do vencimento, mais um — e parte de dt_pgto quando este é posterior ao
      -- vencimento. Difere do "Atraso" exibido, que é a subtração simples.
      LEFT JOIN LATERAL (
        SELECT CASE
          WHEN ${diaJuros} > r.dt_venc AND ${diaJuros} >= (
            SELECT MIN(g.d)::date + 1
            FROM generate_series(r.dt_venc::date, r.dt_venc::date + 20, interval '1 day') g(d)
            WHERE EXTRACT(ISODOW FROM g.d) < 6
              AND NOT EXISTS (
                SELECT 1 FROM dbferiado f
                WHERE f.tipo = 'N' AND (
                  (f.fixo = 'S'
                    AND EXTRACT(DAY FROM f.data) = EXTRACT(DAY FROM g.d)
                    AND EXTRACT(MONTH FROM f.data) = EXTRACT(MONTH FROM g.d))
                  OR (f.fixo = 'N' AND f.data = g.d::date)
                )
              )
          )
          THEN (${diaJuros}::date
                - GREATEST(r.dt_venc::date, COALESCE(r.dt_pgto, r.dt_venc)::date))
          ELSE 0
        END AS dias_juros
      ) jt ON TRUE
      WHERE 1=1 ${whereClause}
    )
    SELECT * FROM base
    WHERE 1=1 ${statusFilter}
    ORDER BY ${orderBy}
  `;

  // Contagem leve para a trava de segurança
  const countSql = `
    SELECT COUNT(*) AS total
    FROM dbreceb r
    LEFT JOIN dbclien c ON c.codcli = r.codcli
    WHERE 1=1 ${whereClause}
  `;

  return { sql, params, countSql, layout: cfg.layout, titulo: cfg.titulo };
}

// ─── PDF generator ──────────────────────────────────────────────────────────

function gerarPDF(
  rows: any[],
  layout: 'geral' | 'por_cliente' | 'por_dia',
  titulo: string,
  colunas: string[],
  data_inicio?: string,
  data_fim?: string,
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, pageW / 2, 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  doc.text(periodo, pageW / 2, 20, { align: 'center' });

  const cols = colunas.map((k) => ({ key: k, ...COLS_REL[k] }));
  const headers = cols.map((c) => c.label);
  const moneyKeys = cols.filter((c) => c.tipo === 'money').map((c) => c.key);
  const firstMoneyIdx = cols.findIndex((c) => c.tipo === 'money');
  const labelSpan = Math.max(1, firstMoneyIdx < 0 ? cols.length : firstMoneyIdx);

  const cellVal = (row: any, c: any) => {
    if (c.tipo === 'money') return fmtMoney(fmtMoneyNum(row[c.campo]));
    if (c.tipo === 'date') return fmtDate(row[c.campo]);
    return row[c.campo] ?? '';
  };
  const dataRow = (row: any) => cols.map((c) => cellVal(row, c));

  const linhaTotal = (label: string, somas: Record<string, number>, fill?: [number, number, number]) => {
    const r: any[] = [
      {
        content: label,
        colSpan: labelSpan,
        styles: { fontStyle: 'bold' as const, fontSize: 7, ...(fill ? { fillColor: fill } : {}) },
      },
    ];
    for (let i = labelSpan; i < cols.length; i++) {
      const c = cols[i];
      if (c.tipo === 'money') {
        r.push({
          content: fmtMoney(somas[c.key] || 0),
          styles: { fontStyle: 'bold' as const, halign: 'right' as const, ...(fill ? { fillColor: fill } : {}) },
        });
      } else {
        r.push(fill ? { content: '', styles: { fillColor: fill } } : '');
      }
    }
    return r;
  };

  const allBody: any[] = [];
  const grand: Record<string, number> = {};
  moneyKeys.forEach((k) => (grand[k] = 0));

  const addRows = (grupo: any[]) => {
    const sub: Record<string, number> = {};
    moneyKeys.forEach((k) => (sub[k] = 0));
    for (const row of grupo) {
      allBody.push(dataRow(row));
      moneyKeys.forEach((k) => {
        const v = fmtMoneyNum(row[COLS_REL[k].campo]);
        sub[k] += v;
        grand[k] += v;
      });
    }
    return sub;
  };

  if (layout === 'por_cliente') {
    const grouped = groupByCliente(rows);
    for (const [clienteKey, grupo] of Array.from(grouped.entries())) {
      allBody.push([
        {
          content: `--------- CLIENTE: ${clienteKey}`,
          colSpan: cols.length,
          styles: { fontStyle: 'bold' as const, fillColor: [220, 230, 241] as [number, number, number], fontSize: 7 },
        },
      ]);
      const sub = addRows(grupo);
      allBody.push(linhaTotal(`Subtotal ${clienteKey}`, sub));
    }
  } else if (layout === 'por_dia') {
    const grouped = groupByDia(rows);
    for (const [dia, grupo] of Array.from(grouped.entries())) {
      allBody.push([
        {
          content: `DIA: ${fmtDate(dia)}`,
          colSpan: cols.length,
          styles: { fontStyle: 'bold' as const, fillColor: [220, 230, 241] as [number, number, number], fontSize: 7 },
        },
      ]);
      const sub = addRows(grupo);
      allBody.push(linhaTotal(`-----TOTAL DIA: ${fmtDate(dia)}`, sub));
    }
  } else {
    addRows(rows);
  }
  allBody.push(linhaTotal(`TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`, grand, [189, 215, 238]));

  const columnStyles: any = {};
  cols.forEach((c, i) => {
    if (c.tipo === 'money' || c.tipo === 'num') columnStyles[i] = { halign: 'right' };
  });

  autoTable(doc, {
    startY: 25,
    head: [headers],
    body: allBody,
    styles: { fontSize: 7, cellPadding: 1, overflow: 'ellipsize' },
    headStyles: { fillColor: [31, 73, 125], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles,
    tableWidth: 'auto',
    theme: 'grid',
    margin: { top: 25, left: 3, right: 3 },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.text(`Página ${data.pageNumber}`, pageW - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 10, doc.internal.pageSize.getHeight() - 5);
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Excel generator ────────────────────────────────────────────────────────

async function gerarExcel(
  rows: any[],
  layout: 'geral' | 'por_cliente' | 'por_dia',
  titulo: string,
  colunas: string[],
  data_inicio?: string,
  data_fim?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema Melo';
  wb.created = new Date();
  const ws = wb.addWorksheet('Contas a Receber', { pageSetup: { orientation: 'landscape', paperSize: 9 } });

  const cols = colunas.map((k) => ({ key: k, ...COLS_REL[k] }));
  const NUM_COLS = cols.length;
  const moneyKeys = cols.filter((c) => c.tipo === 'money').map((c) => c.key);
  const firstMoneyIdx = cols.findIndex((c) => c.tipo === 'money');
  const labelSpan = Math.max(1, firstMoneyIdx < 0 ? NUM_COLS : firstMoneyIdx);

  // Título + período
  const titleRow = ws.addRow([titulo]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, NUM_COLS);
  titleRow.font = { bold: true, size: 13 };
  titleRow.alignment = { horizontal: 'center' };

  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  const subRow = ws.addRow([periodo]);
  ws.mergeCells(subRow.number, 1, subRow.number, NUM_COLS);
  subRow.font = { size: 9, italic: true };
  subRow.alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Cabeçalho
  const headerRow = ws.addRow(cols.map((c) => c.label));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 18;

  ws.columns = cols.map((c) => ({
    width: c.tipo === 'money' ? 18 : c.tipo === 'date' ? 14 : c.key === 'cliente' ? 45 : 14,
  }));

  const grand: Record<string, number> = {};
  moneyKeys.forEach((k) => (grand[k] = 0));

  const addData = (row: any) => {
    const values = cols.map((c) => {
      if (c.tipo === 'money') {
        const v = fmtMoneyNum(row[c.campo]);
        grand[c.key] += v;
        return v;
      }
      if (c.tipo === 'date') return row[c.campo] ? new Date(row[c.campo]) : '';
      return row[c.campo] ?? '';
    });
    const dr = ws.addRow(values);
    dr.font = { size: 8 };
    dr.alignment = { vertical: 'middle' };
    cols.forEach((c, i) => {
      const cell = dr.getCell(i + 1);
      if (c.tipo === 'money') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (c.tipo === 'num') {
        cell.alignment = { horizontal: 'right' };
      } else if (c.tipo === 'date' && cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy';
      }
    });
    return values;
  };

  const linhaTotal = (label: string, somas: Record<string, number>, fillArgb: string, bold = true) => {
    const arr: any[] = [];
    for (let i = 0; i < NUM_COLS; i++) {
      if (i === 0) arr.push(label);
      else if (i < labelSpan) arr.push('');
      else {
        const c = cols[i];
        arr.push(c.tipo === 'money' ? somas[c.key] || 0 : '');
      }
    }
    const tr = ws.addRow(arr);
    if (labelSpan > 1) ws.mergeCells(tr.number, 1, tr.number, labelSpan);
    tr.font = { bold, size: 9 };
    tr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cols.forEach((c, i) => {
      if (c.tipo === 'money') {
        const cell = tr.getCell(i + 1);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
        cell.font = { bold, size: 9 };
      }
    });
    return tr;
  };

  if (layout === 'por_cliente') {
    const grouped = groupByCliente(rows);
    for (const [clienteKey, grupo] of Array.from(grouped.entries())) {
      const sepRow = ws.addRow([`--------- CLIENTE: ${clienteKey}`]);
      ws.mergeCells(sepRow.number, 1, sepRow.number, NUM_COLS);
      sepRow.font = { bold: true, size: 9 };
      sepRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      sepRow.alignment = { horizontal: 'left', vertical: 'middle' };
      sepRow.height = 16;

      const sub: Record<string, number> = {};
      moneyKeys.forEach((k) => (sub[k] = 0));
      for (const r of grupo) {
        addData(r);
        moneyKeys.forEach((k) => (sub[k] += fmtMoneyNum(r[COLS_REL[k].campo])));
      }
      linhaTotal(`Subtotal ${clienteKey}`, sub, 'FFEAF1F8', true);
    }
  } else if (layout === 'por_dia') {
    const grouped = groupByDia(rows);
    for (const [dia, grupo] of Array.from(grouped.entries())) {
      const sepRow = ws.addRow([`DIA: ${fmtDate(dia)}`]);
      ws.mergeCells(sepRow.number, 1, sepRow.number, NUM_COLS);
      sepRow.font = { bold: true, size: 9 };
      sepRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      sepRow.alignment = { horizontal: 'left', vertical: 'middle' };
      sepRow.height = 16;

      const sub: Record<string, number> = {};
      moneyKeys.forEach((k) => (sub[k] = 0));
      for (const r of grupo) {
        addData(r);
        moneyKeys.forEach((k) => (sub[k] += fmtMoneyNum(r[COLS_REL[k].campo])));
      }
      linhaTotal(`-----TOTAL DIA: ${fmtDate(dia)}`, sub, 'FFEAF1F8', true);
    }
  } else {
    for (const r of rows) addData(r);
  }

  linhaTotal(`TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`, grand, 'FFBDD7EE', true);

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: NUM_COLS } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = await getPgPoolFilial(req);
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { formato, tipo, data_inicio, data_fim, status, cod_receb, cliente, nro_doc, cod_fat, search, codcli, cod_conta, classe_pgto, tx_juros, codvend, uf, rec_filtro, orgaos, dia_juros, tarifa, colunas } = req.query;
  const colunasSel = parseColunas(colunas as string | undefined);

  if (!formato || (formato !== 'pdf' && formato !== 'excel' && formato !== 'json')) {
    return res.status(400).json({
      erro: 'Parâmetro "formato" é obrigatório e deve ser "pdf", "excel" ou "json".',
    });
  }

  const tipoVal = (tipo as string) || 'geral';
  if (!TIPO_CONFIG[tipoVal]) {
    return res.status(400).json({
      erro: `Parâmetro "tipo" inválido. Use: ${Object.keys(TIPO_CONFIG).join(', ')}.`,
    });
  }

  try {
    const { sql, params, countSql, layout, titulo } = buildQuery(
      tipoVal,
      data_inicio as string | undefined,
      data_fim as string | undefined,
      status as string | undefined,
      {
        cod_receb: cod_receb as string | undefined,
        cliente: cliente as string | undefined,
        nro_doc: nro_doc as string | undefined,
        cod_fat: cod_fat as string | undefined,
        search: search as string | undefined,
      },
      {
        codcli: codcli as string | undefined,
        cod_conta: cod_conta as string | undefined,
        classe_pgto: classe_pgto as string | undefined,
        tx_juros: tx_juros as string | undefined,
        codvend: codvend as string | undefined,
        uf: uf as string | undefined,
        rec_filtro: rec_filtro as string | undefined,
        orgaos: orgaos as string | undefined,
        dia_juros: dia_juros as string | undefined,
        tarifa: tarifa as string | undefined,
      },
    );

    console.log('📊 Relatório Contas a Receber:', { tipoVal, data_inicio, data_fim, status, paramsCount: params.length });

    // Trava de segurança: evita gerar relatórios gigantes que travariam o servidor
    const MAX_LINHAS = 25000;
    const client = await pool.connect();
    let rows: any[] = [];
    let totalLinhas = 0;
    let excedeuLimite = false;
    try {
      const countResult = await client.query(countSql, params);
      totalLinhas = parseInt(countResult.rows[0]?.total ?? '0', 10);
      if (totalLinhas > MAX_LINHAS) {
        excedeuLimite = true;
      } else {
        const result = await client.query(sql, params);
        rows = result.rows;
      }
    } finally {
      client.release();
    }

    if (excedeuLimite) {
      const msg = `O relatório resultaria em ${totalLinhas.toLocaleString('pt-BR')} registros, acima do limite de ${MAX_LINHAS.toLocaleString('pt-BR')}. Selecione um período (Semana/Mês/Personalizado) ou aplique um filtro de coluna (ex.: Cliente) e tente novamente.`;
      return res.status(413).json({ error: msg, erro: msg });
    }

    console.log(`📊 Registros encontrados: ${rows.length}`);

    // Preview na tela (fluxo igual ao Contas a Pagar): retorna as linhas em JSON.
    if (formato === 'json') {
      return res.status(200).json({ titulo, layout, rows });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro encontrado para o período/filtros selecionados.' });
    }

    const periodoStr =
      (data_inicio ? `_${data_inicio}` : '') +
      (data_fim ? `_a_${data_fim}` : '');

    if (formato === 'pdf') {
      const buffer = gerarPDF(
        rows,
        layout,
        titulo,
        colunasSel,
        data_inicio as string | undefined,
        data_fim as string | undefined,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="contas_receber_${tipoVal}${periodoStr}.pdf"`,
      );
      return res.end(buffer);
    }

    // Excel
    const buffer = await gerarExcel(
      rows,
      layout,
      titulo,
      colunasSel,
      data_inicio as string | undefined,
      data_fim as string | undefined,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contas_receber_${tipoVal}${periodoStr}.xlsx"`,
    );
    return res.end(buffer);
  } catch (error: any) {
    console.error('Erro ao gerar relatório de contas a receber:', error);
    return res.status(500).json({
      erro: 'Erro interno ao gerar relatório',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

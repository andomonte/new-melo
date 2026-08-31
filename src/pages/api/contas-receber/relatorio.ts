import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const pool = getPgPool();

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
  { layout: 'geral' | 'por_cliente'; titulo: string; extraWhere: string; dateField: string; fonte: 'dbreceb' | 'dbfreceb' }
> = {
  geral:                { layout: 'geral',       titulo: 'RELATÓRIO DE CONTAS A RECEBER', extraWhere: '',                                                            dateField: 'dt_venc',    fonte: 'dbreceb' },
  por_cliente:          { layout: 'por_cliente', titulo: 'CONTAS A RECEBER POR CLIENTE',  extraWhere: '',                                                            dateField: 'dt_venc',    fonte: 'dbreceb' },
  receber_periodo:      { layout: 'geral',       titulo: 'RECEBER NO PERÍODO',            extraWhere: ` AND r.rec IS DISTINCT FROM 'S'`,                              dateField: 'dt_venc',    fonte: 'dbreceb' },
  em_atraso:            { layout: 'geral',       titulo: 'TÍTULOS EM ATRASO NO PERÍODO',  extraWhere: ` AND r.rec IS DISTINCT FROM 'S' AND r.dt_venc < CURRENT_DATE`,  dateField: 'dt_venc',    fonte: 'dbreceb' },
  diario_avista:        { layout: 'geral',       titulo: 'TÍTULOS DIÁRIO À VISTA',        extraWhere: ` AND UPPER(COALESCE(c.claspgto,'')) = 'V'`,                    dateField: 'dt_emissao', fonte: 'dbreceb' },
  recebimento_clientes: { layout: 'geral',       titulo: 'RECEBIMENTO DE CLIENTES',       extraWhere: ` AND fr.tipo <> 'E'`,                                          dateField: 'dt_pgto',    fonte: 'dbfreceb' },
};

function buildQuery(
  tipo: string,
  data_inicio?: string,
  data_fim?: string,
  status?: string,
  colFiltros: { cod_receb?: string; cliente?: string; nro_doc?: string; cod_fat?: string; search?: string } = {},
  extra: { codcli?: string; cod_conta?: string; classe_pgto?: string; tx_juros?: string } = {},
): { sql: string; params: any[]; countSql: string; layout: 'geral' | 'por_cliente'; titulo: string } {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.geral;
  const params: any[] = [];
  let idx = 1;
  let whereClause = '';
  // Taxa de juros (número seguro — interpolada direto no SQL do juros projetado).
  const tx = Number(String(extra.tx_juros ?? '').replace(',', '.')) || 0;

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
  if (extra.classe_pgto === 'V' || extra.classe_pgto === 'I') {
    whereClause += ` AND UPPER(COALESCE(c.claspgto,'')) = $${idx}`;
    params.push(extra.classe_pgto); idx++;
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
      ORDER BY cliente ASC, fr.dt_pgto ASC
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

  const orderBy = 'cliente ASC, dt_venc ASC';

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
        GREATEST(0, CAST(CURRENT_DATE AS DATE) - CAST(r.dt_venc AS DATE)) AS dias,
        COALESCE(c.codcli::text, '') || ' ' || COALESCE(c.nome, '') AS cliente,
        r.cod_conta,
        COALESCE(r.valor_pgto, 0) AS valor_pgto,
        ${
          tx > 0
            ? `CASE WHEN r.rec IS DISTINCT FROM 'S' AND r.dt_venc < CURRENT_DATE
                 THEN ROUND((GREATEST(0, CURRENT_DATE - r.dt_venc) * COALESCE(r.valor_pgto,0) * (${tx}/3000.0))::numeric, 2)
                 ELSE GREATEST(0, COALESCE(r.valor_rec, 0) - COALESCE(r.valor_pgto, 0)) END`
            : `GREATEST(0, COALESCE(r.valor_rec, 0) - COALESCE(r.valor_pgto, 0))`
        } AS valor_juros,
        COALESCE(r.valor_rec, 0) AS valor_rec,
        COALESCE(r.valor_pgto, 0) - COALESCE(r.valor_rec, 0) AS valor_aberto,
        r.dt_emissao,
        r.dt_venc,
        0 AS tarifa,
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
  layout: 'geral' | 'por_cliente',
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
  layout: 'geral' | 'por_cliente',
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
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { formato, tipo, data_inicio, data_fim, status, cod_receb, cliente, nro_doc, cod_fat, search, codcli, cod_conta, classe_pgto, tx_juros, colunas } = req.query;
  const colunasSel = parseColunas(colunas as string | undefined);

  if (!formato || (formato !== 'pdf' && formato !== 'excel')) {
    return res.status(400).json({
      erro: 'Parâmetro "formato" é obrigatório e deve ser "pdf" ou "excel".',
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

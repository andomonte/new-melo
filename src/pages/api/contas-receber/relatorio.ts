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
): { sql: string; params: any[]; countSql: string; layout: 'geral' | 'por_cliente'; titulo: string } {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.geral;
  const params: any[] = [];
  let idx = 1;
  let whereClause = '';

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
        GREATEST(0, COALESCE(r.valor_rec, 0) - COALESCE(r.valor_pgto, 0)) AS valor_juros,
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
  data_inicio?: string,
  data_fim?: string,
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();

  // Title
  const titleText = titulo;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(titleText, pageW / 2, 14, { align: 'center' });

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  doc.text(periodo, pageW / 2, 20, { align: 'center' });

  // Column headers
  const headers = [
    'NRO_DOC', 'DIAS', 'CLIENTE', 'COD_CONTA',
    'VALOR_PGTO', 'VALOR_JUROS', 'VALOR_REC', 'VALOR_ABERTO',
    'DT_EMISSAO', 'DT_VENC', 'PARCELA', 'TARIFA', 'DT_PGTO',
  ];

  const allBody: any[] = [];

  // Money column indices (0-based): VALOR_PGTO=4, VALOR_JUROS=5, VALOR_REC=6, VALOR_ABERTO=7, TARIFA=10
  const moneyColSpan = headers.length;

  if (layout === 'por_cliente') {
    const grouped = groupByCliente(rows);

    for (const [clienteKey, grupo] of Array.from(grouped.entries())) {
      // Group header row
      const groupRow = [
        {
          content: `--------- CLIENTE: ${clienteKey}`,
          colSpan: headers.length,
          styles: {
            fontStyle: 'bold' as const,
            fillColor: [220, 230, 241] as [number, number, number],
            textColor: [0, 0, 0] as [number, number, number],
            fontSize: 7,
          },
        },
      ];
      allBody.push(groupRow);

      let subValorPgto = 0;
      let subValorJuros = 0;
      let subValorRec = 0;
      let subValorAberto = 0;

      for (const r of grupo) {
        const valorPgto = fmtMoneyNum(r.valor_pgto);
        const valorJuros = fmtMoneyNum(r.valor_juros);
        const valorRec = fmtMoneyNum(r.valor_rec);
        const valorAberto = fmtMoneyNum(r.valor_aberto);
        subValorPgto += valorPgto;
        subValorJuros += valorJuros;
        subValorRec += valorRec;
        subValorAberto += valorAberto;

        allBody.push([
          r.nro_doc ?? '',
          r.dias ?? 0,
          r.cliente ?? '',
          r.cod_conta ?? '',
          fmtMoney(valorPgto),
          fmtMoney(valorJuros),
          fmtMoney(valorRec),
          fmtMoney(valorAberto),
          fmtDate(r.dt_emissao),
          fmtDate(r.dt_venc),
          r.parcela ?? '',
          fmtMoney(r.tarifa ?? 0),
          fmtDate(r.dt_pgto),
        ]);
      }

      // Subtotal row per client
      allBody.push([
        {
          content: `Subtotal ${clienteKey}`,
          colSpan: 4,
          styles: { fontStyle: 'bold' as const, fontSize: 7 },
        },
        { content: fmtMoney(subValorPgto), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: fmtMoney(subValorJuros), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: fmtMoney(subValorRec), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: fmtMoney(subValorAberto), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        '', '', '', '', '',
      ]);
    }
  } else {
    // Geral: flat list
    for (const r of rows) {
      allBody.push([
        r.nro_doc ?? '',
        r.dias ?? 0,
        r.cliente ?? '',
        r.cod_conta ?? '',
        fmtMoney(fmtMoneyNum(r.valor_pgto)),
        fmtMoney(fmtMoneyNum(r.valor_juros)),
        fmtMoney(fmtMoneyNum(r.valor_rec)),
        fmtMoney(fmtMoneyNum(r.valor_aberto)),
        fmtDate(r.dt_emissao),
        fmtDate(r.dt_venc),
        r.parcela ?? '',
        fmtMoney(r.tarifa ?? 0),
        fmtDate(r.dt_pgto),
      ]);
    }
  }

  // Grand total
  const grandValorPgto = rows.reduce((s, r) => s + fmtMoneyNum(r.valor_pgto), 0);
  const grandValorJuros = rows.reduce((s, r) => s + fmtMoneyNum(r.valor_juros), 0);
  const grandValorRec = rows.reduce((s, r) => s + fmtMoneyNum(r.valor_rec), 0);
  const grandValorAberto = rows.reduce((s, r) => s + fmtMoneyNum(r.valor_aberto), 0);

  allBody.push([
    {
      content: `TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`,
      colSpan: 4,
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        fontSize: 8,
      },
    },
    {
      content: fmtMoney(grandValorPgto),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    {
      content: fmtMoney(grandValorJuros),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    {
      content: fmtMoney(grandValorRec),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    {
      content: fmtMoney(grandValorAberto),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    '', '', '', '', '',
  ]);

  autoTable(doc, {
    startY: 25,
    head: [headers],
    body: allBody,
    styles: { fontSize: 7, cellPadding: 1, overflow: 'ellipsize' },
    headStyles: {
      fillColor: [31, 73, 125],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      1:  { halign: 'right' },  // DIAS
      4:  { halign: 'right' },  // VALOR_PGTO
      5:  { halign: 'right' },  // VALOR_JUROS
      6:  { halign: 'right' },  // VALOR_REC
      7:  { halign: 'right' },  // VALOR_ABERTO
      11: { halign: 'right' },  // TARIFA (deslocada por PARCELA)
    },
    tableWidth: 'auto',
    theme: 'grid',
    margin: { top: 25, left: 3, right: 3 },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.text(
        `Página ${data.pageNumber}`,
        pageW - 10,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'right' },
      );
      doc.text(
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        10,
        doc.internal.pageSize.getHeight() - 5,
      );
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Excel generator ────────────────────────────────────────────────────────

async function gerarExcel(
  rows: any[],
  layout: 'geral' | 'por_cliente',
  titulo: string,
  data_inicio?: string,
  data_fim?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema Melo';
  wb.created = new Date();

  const ws = wb.addWorksheet('Contas a Receber', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  });

  // ── Title rows ──────────────────────────────────────────────────────────
  const NUM_COLS = 13;
  const lastCol = 'M'; // column 13

  const titleText = titulo;

  const titleRow = ws.addRow([titleText]);
  ws.mergeCells(`A${titleRow.number}:${lastCol}${titleRow.number}`);
  titleRow.font = { bold: true, size: 13 };
  titleRow.alignment = { horizontal: 'center' };

  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  const subRow = ws.addRow([periodo]);
  ws.mergeCells(`A${subRow.number}:${lastCol}${subRow.number}`);
  subRow.font = { size: 9, italic: true };
  subRow.alignment = { horizontal: 'center' };

  ws.addRow([]); // blank

  // ── Header row ──────────────────────────────────────────────────────────
  const headerLabels = [
    'NRO_DOC', 'DIAS', 'CLIENTE', 'COD_CONTA',
    'VALOR_PGTO', 'VALOR_JUROS', 'VALOR_REC', 'VALOR_ABERTO',
    'DT_EMISSAO', 'DT_VENC', 'PARCELA', 'TARIFA', 'DT_PGTO',
  ];
  const headerRow = ws.addRow(headerLabels);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F497D' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 18;

  // ── Column widths ───────────────────────────────────────────────────────
  ws.columns = [
    { key: 'nro_doc',      width: 18 },
    { key: 'dias',         width: 10 },
    { key: 'cliente',      width: 45 },
    { key: 'cod_conta',    width: 14 },
    { key: 'valor_pgto',   width: 18 },
    { key: 'valor_juros',  width: 16 },
    { key: 'valor_rec',    width: 18 },
    { key: 'valor_aberto', width: 18 },
    { key: 'dt_emissao',   width: 14 },
    { key: 'dt_venc',      width: 14 },
    { key: 'parcela',      width: 12 },
    { key: 'tarifa',       width: 14 },
    { key: 'dt_pgto',      width: 14 },
  ];

  // Money columns: E, F, G, H, L (TARIFA deslocada por PARCELA)
  const moneyCols = ['E', 'F', 'G', 'H', 'L'];
  // Date columns: I, J, M
  const dateCols = ['I', 'J', 'M'];

  let grandValorPgto = 0;
  let grandValorJuros = 0;
  let grandValorRec = 0;
  let grandValorAberto = 0;

  const addDataRow = (r: any) => {
    const valorPgto = fmtMoneyNum(r.valor_pgto);
    const valorJuros = fmtMoneyNum(r.valor_juros);
    const valorRec = fmtMoneyNum(r.valor_rec);
    const valorAberto = fmtMoneyNum(r.valor_aberto);
    grandValorPgto += valorPgto;
    grandValorJuros += valorJuros;
    grandValorRec += valorRec;
    grandValorAberto += valorAberto;

    const dataRow = ws.addRow({
      nro_doc:      r.nro_doc ?? '',
      dias:         r.dias ?? 0,
      cliente:      r.cliente ?? '',
      cod_conta:    r.cod_conta ?? '',
      valor_pgto:   valorPgto,
      valor_juros:  valorJuros,
      valor_rec:    valorRec,
      valor_aberto: valorAberto,
      dt_emissao:   r.dt_emissao ? new Date(r.dt_emissao) : '',
      dt_venc:      r.dt_venc ? new Date(r.dt_venc) : '',
      parcela:      r.parcela ?? '',
      tarifa:       fmtMoneyNum(r.tarifa ?? 0),
      dt_pgto:      r.dt_pgto ? new Date(r.dt_pgto) : '',
    });

    dataRow.font = { size: 8 };
    dataRow.alignment = { vertical: 'middle' };

    moneyCols.forEach((col) => {
      const cell = dataRow.getCell(col);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    });

    dateCols.forEach((col) => {
      const cell = dataRow.getCell(col);
      if (cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy';
      }
    });

    return { valorPgto, valorJuros, valorRec, valorAberto };
  };

  if (layout === 'por_cliente') {
    const grouped = groupByCliente(rows);

    for (const [clienteKey, grupo] of Array.from(grouped.entries())) {
      // Group separator row
      const sepRow = ws.addRow([`--------- CLIENTE: ${clienteKey}`]);
      ws.mergeCells(`A${sepRow.number}:${lastCol}${sepRow.number}`);
      sepRow.font = { bold: true, size: 9 };
      sepRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCE6F1' },
      };
      sepRow.alignment = { horizontal: 'left', vertical: 'middle' };
      sepRow.height = 16;

      let subValorPgto = 0;
      let subValorJuros = 0;
      let subValorRec = 0;
      let subValorAberto = 0;

      for (const r of grupo) {
        const totals = addDataRow(r);
        subValorPgto += totals.valorPgto;
        subValorJuros += totals.valorJuros;
        subValorRec += totals.valorRec;
        subValorAberto += totals.valorAberto;
      }

      // Subtotal row per client
      const subRow2 = ws.addRow([
        `Subtotal ${clienteKey}`, '', '', '',
        subValorPgto, subValorJuros, subValorRec, subValorAberto,
        '', '', '', '', '',
      ]);
      subRow2.font = { bold: true, size: 8 };
      subRow2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF1F8' },
      };
      moneyCols.forEach((col) => {
        const cell = subRow2.getCell(col);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      });
    }
  } else {
    // Geral: flat list
    for (const r of rows) {
      addDataRow(r);
    }
  }

  // Grand total row
  const totalRow = ws.addRow([
    `TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`,
    '', '', '',
    grandValorPgto, grandValorJuros, grandValorRec, grandValorAberto,
    '', '', '', '', '',
  ]);
  totalRow.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBDD7EE' },
  };
  totalRow.height = 18;
  moneyCols.forEach((col) => {
    const cell = totalRow.getCell(col);
    cell.numFmt = '#,##0.00';
    cell.alignment = { horizontal: 'right' };
    cell.font = { bold: true, size: 9 };
  });

  // Freeze header row (row 4)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // Auto-filter on header row
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: NUM_COLS },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { formato, tipo, data_inicio, data_fim, status, cod_receb, cliente, nro_doc, cod_fat, search } = req.query;

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

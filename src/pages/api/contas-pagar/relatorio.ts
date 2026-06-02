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

// Group rows by DT_VENC (YYYY-MM-DD string)
function groupByVenc(rows: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.dt_venc
      ? new Date(row.dt_venc).toISOString().split('T')[0]
      : 'SEM DATA';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  // Sort keys ascending
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return new Map(sorted);
}

// ─── SQL ────────────────────────────────────────────────────────────────────

function buildQuery(
  data_inicio?: string,
  data_fim?: string,
  status?: string,
): { sql: string; params: any[] } {
  const params: any[] = [];
  let idx = 1;
  let whereClause = '';

  if (data_inicio) {
    whereClause += ` AND p.dt_venc >= $${idx++}`;
    params.push(data_inicio);
  }
  if (data_fim) {
    whereClause += ` AND p.dt_venc <= $${idx++}`;
    params.push(data_fim);
  }

  // Determinar filtro de status após CTE
  let statusFilter = '';
  if (status && status !== 'todos') {
    if (status === 'pendente_parcial') {
      statusFilter = `AND calc_status IN ('pendente', 'pago_parcial')`;
    } else {
      statusFilter = `AND calc_status = '${status.replace(/'/g, "''")}'`;
    }
  }

  // Por padrão oculta cancelados
  const ocultarCancelados = !status || status !== 'cancelado';
  if (ocultarCancelados) {
    whereClause += ` AND p.cancel != 'S'`;
  }

  const sql = `
    WITH base AS (
      SELECT
        p.cod_pgto,
        p.nro_dup,
        CASE
          WHEN p.tipo = 'T' THEN t.nome
          ELSE c.nome
        END AS nome,
        p.valor_pgto,
        COALESCE(
          (SELECT SUM(f.valor_pgto)
           FROM db_manaus.dbfpgto f
           WHERE f.cod_pgto = p.cod_pgto
             AND (f.cancel IS NULL OR f.cancel != 'S')
          ), 0
        ) AS total_pago,
        p.nro_nf,
        p.dt_venc,
        cf.cof_descricao AS conta_financeira,
        p.dt_pgto,
        p.dt_emissao,
        p.cod_conta,
        p.obs,
        p.paga,
        CASE
          WHEN p.cancel = 'S' THEN 'cancelado'
          WHEN COALESCE(
            (SELECT SUM(f.valor_pgto)
             FROM db_manaus.dbfpgto f
             WHERE f.cod_pgto = p.cod_pgto
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) >= p.valor_pgto THEN 'pago'
          WHEN COALESCE(
            (SELECT SUM(f.valor_pgto)
             FROM db_manaus.dbfpgto f
             WHERE f.cod_pgto = p.cod_pgto
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) > 0 THEN 'pago_parcial'
          ELSE 'pendente'
        END AS calc_status
      FROM db_manaus.dbpgto p
      LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
      LEFT JOIN db_manaus.dbtransp t ON t.codtransp = p.cod_transp
      LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = CAST(p.cod_conta AS INTEGER)
      WHERE 1=1 ${whereClause}
    )
    SELECT * FROM base
    WHERE 1=1 ${statusFilter}
    ORDER BY dt_venc ASC, cod_pgto ASC
  `;

  return { sql, params };
}

// ─── PDF generator ──────────────────────────────────────────────────────────

function gerarPDF(
  rows: any[],
  data_inicio?: string,
  data_fim?: string,
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE CONTAS A PAGAR', pageW / 2, 14, { align: 'center' });

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  doc.text(periodo, pageW / 2, 20, { align: 'center' });

  const grouped = groupByVenc(rows);

  // Column headers
  const headers = [
    'COD', 'NRO_DUP', 'NOME', 'VALOR', 'PAGO', 'ABERTO',
    'NRO_NF', 'DT_VENC', 'CONTA_FINANCEIRA', 'DT_PGTO',
    'DT_EMISSAO', 'COD_CONTA', 'OBS', 'PAGA',
  ];

  const allBody: any[] = [];

  for (const [dateKey, grupo] of Array.from(grouped.entries())) {
    // Group header row
    const labelDate =
      dateKey === 'SEM DATA'
        ? 'SEM DATA'
        : new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR');
    const groupRow = [
      {
        content: `--------- DATA VENCTO..: ${labelDate}`,
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

    let totalValor = 0;
    let totalPago = 0;
    let totalAberto = 0;

    for (const r of grupo) {
      const valor = fmtMoneyNum(r.valor_pgto);
      const pago = fmtMoneyNum(r.total_pago);
      const aberto = fmtMoneyNum(valor - pago);
      totalValor += valor;
      totalPago += pago;
      totalAberto += aberto;

      allBody.push([
        r.cod_pgto ?? '',
        r.nro_dup ?? '',
        r.nome ?? '',
        fmtMoney(valor),
        fmtMoney(pago),
        fmtMoney(aberto),
        r.nro_nf ?? '',
        fmtDate(r.dt_venc),
        r.conta_financeira ?? '',
        fmtDate(r.dt_pgto),
        fmtDate(r.dt_emissao),
        r.cod_conta ?? '',
        r.obs ?? '',
        r.paga ?? '',
      ]);
    }

    // Subtotal row per group
    allBody.push([
      {
        content: `Subtotal ${labelDate}`,
        colSpan: 3,
        styles: { fontStyle: 'bold' as const, fontSize: 7 },
      },
      { content: fmtMoney(totalValor), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      { content: fmtMoney(totalPago), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      { content: fmtMoney(totalAberto), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      '', '', '', '', '', '', '', '',
    ]);
  }

  // Grand total
  const grandValor = rows.reduce((s, r) => s + fmtMoneyNum(r.valor_pgto), 0);
  const grandPago = rows.reduce((s, r) => s + fmtMoneyNum(r.total_pago), 0);
  const grandAberto = grandValor - grandPago;
  allBody.push([
    {
      content: `TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`,
      colSpan: 3,
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        fontSize: 8,
      },
    },
    {
      content: fmtMoney(grandValor),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    {
      content: fmtMoney(grandPago),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    {
      content: fmtMoney(grandAberto),
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [189, 215, 238] as [number, number, number],
        halign: 'right' as const,
      },
    },
    '', '', '', '', '', '', '', '',
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
      3:  { halign: 'right' },  // VALOR
      4:  { halign: 'right' },  // PAGO
      5:  { halign: 'right' },  // ABERTO
    },
    tableWidth: 'auto',
    theme: 'grid',
    margin: { top: 25, left: 3, right: 3 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = (doc as any).internal.getNumberOfPages();
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
  data_inicio?: string,
  data_fim?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema Melo';
  wb.created = new Date();

  const ws = wb.addWorksheet('Contas a Pagar', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  });

  // ── Title rows ──────────────────────────────────────────────────────────
  const NUM_COLS = 14;

  const titleRow = ws.addRow(['RELATÓRIO DE CONTAS A PAGAR']);
  ws.mergeCells(`A${titleRow.number}:N${titleRow.number}`);
  titleRow.font = { bold: true, size: 13 };
  titleRow.alignment = { horizontal: 'center' };

  const periodo =
    data_inicio || data_fim
      ? `Período: ${data_inicio ? fmtDate(data_inicio + 'T00:00:00') : 'início'} a ${data_fim ? fmtDate(data_fim + 'T00:00:00') : 'fim'}`
      : 'Todos os períodos';
  const subRow = ws.addRow([periodo]);
  ws.mergeCells(`A${subRow.number}:N${subRow.number}`);
  subRow.font = { size: 9, italic: true };
  subRow.alignment = { horizontal: 'center' };

  ws.addRow([]); // blank

  // ── Header row ──────────────────────────────────────────────────────────
  const headerLabels = [
    'COD', 'NRO_DUP', 'NOME', 'VALOR', 'PAGO', 'ABERTO',
    'NRO_NF', 'DT_VENC', 'CONTA_FINANCEIRA', 'DT_PGTO',
    'DT_EMISSAO', 'COD_CONTA', 'OBS', 'PAGA',
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
    { key: 'cod_pgto',          width: 10 },
    { key: 'nro_dup',           width: 18 },
    { key: 'nome',              width: 35 },
    { key: 'valor_pgto',        width: 16 },
    { key: 'total_pago',        width: 16 },
    { key: 'aberto',            width: 16 },
    { key: 'nro_nf',            width: 14 },
    { key: 'dt_venc',           width: 14 },
    { key: 'conta_financeira',  width: 28 },
    { key: 'dt_pgto',           width: 14 },
    { key: 'dt_emissao',        width: 14 },
    { key: 'cod_conta',         width: 12 },
    { key: 'obs',               width: 32 },
    { key: 'paga',              width: 8  },
  ];

  const grouped = groupByVenc(rows);

  let grandValor = 0;
  let grandPago = 0;
  let grandAberto = 0;

  for (const [dateKey, grupo] of Array.from(grouped.entries())) {
    const labelDate =
      dateKey === 'SEM DATA'
        ? 'SEM DATA'
        : new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR');

    // Group separator row
    const sepRow = ws.addRow([`--------- DATA VENCTO..: ${labelDate}`]);
    ws.mergeCells(`A${sepRow.number}:N${sepRow.number}`);
    sepRow.font = { bold: true, size: 9 };
    sepRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCE6F1' },
    };
    sepRow.alignment = { horizontal: 'left', vertical: 'middle' };
    sepRow.height = 16;

    let subValor = 0;
    let subPago = 0;
    let subAberto = 0;

    for (const r of grupo) {
      const valor = fmtMoneyNum(r.valor_pgto);
      const pago = fmtMoneyNum(r.total_pago);
      const aberto = fmtMoneyNum(valor - pago);
      subValor += valor;
      subPago += pago;
      subAberto += aberto;
      grandValor += valor;
      grandPago += pago;
      grandAberto += aberto;

      const dataRow = ws.addRow({
        cod_pgto:         r.cod_pgto ?? '',
        nro_dup:          r.nro_dup ?? '',
        nome:             r.nome ?? '',
        valor_pgto:       valor,
        total_pago:       pago,
        aberto:           aberto,
        nro_nf:           r.nro_nf ?? '',
        dt_venc:          r.dt_venc ? new Date(r.dt_venc) : '',
        conta_financeira: r.conta_financeira ?? '',
        dt_pgto:          r.dt_pgto ? new Date(r.dt_pgto) : '',
        dt_emissao:       r.dt_emissao ? new Date(r.dt_emissao) : '',
        cod_conta:        r.cod_conta ?? '',
        obs:              r.obs ?? '',
        paga:             r.paga ?? '',
      });

      dataRow.font = { size: 8 };
      dataRow.alignment = { vertical: 'middle' };

      // Money columns: D, E, F (indices 3, 4, 5 → columns 4, 5, 6)
      ['D', 'E', 'F'].forEach((col) => {
        const cell = dataRow.getCell(col);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      });

      // Date columns: H, J, K
      ['H', 'J', 'K'].forEach((col) => {
        const cell = dataRow.getCell(col);
        if (cell.value instanceof Date) {
          cell.numFmt = 'dd/mm/yyyy';
        }
      });
    }

    // Subtotal row per group
    const subRow2 = ws.addRow([
      `Subtotal ${labelDate}`, '', '',
      subValor, subPago, subAberto,
      '', '', '', '', '', '', '', '',
    ]);
    subRow2.font = { bold: true, size: 8 };
    subRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAF1F8' },
    };
    ['D', 'E', 'F'].forEach((col) => {
      const cell = subRow2.getCell(col);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    });
  }

  // Grand total row
  const totalRow = ws.addRow([
    `TOTAL GERAL (${rows.length} registro${rows.length !== 1 ? 's' : ''})`,
    '', '',
    grandValor, grandPago, grandAberto,
    '', '', '', '', '', '', '', '',
  ]);
  totalRow.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBDD7EE' },
  };
  totalRow.height = 18;
  ['D', 'E', 'F'].forEach((col) => {
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

  const { formato, data_inicio, data_fim, status } = req.query;

  if (!formato || (formato !== 'pdf' && formato !== 'excel')) {
    return res.status(400).json({
      erro: 'Parâmetro "formato" é obrigatório e deve ser "pdf" ou "excel".',
    });
  }

  try {
    const { sql, params } = buildQuery(
      data_inicio as string | undefined,
      data_fim as string | undefined,
      status as string | undefined,
    );

    const client = await pool.connect();
    let rows: any[];
    try {
      const result = await client.query(sql, params);
      rows = result.rows;
    } finally {
      client.release();
    }

    const periodoStr =
      (data_inicio ? `_${data_inicio}` : '') +
      (data_fim ? `_a_${data_fim}` : '');

    if (formato === 'pdf') {
      const buffer = gerarPDF(
        rows,
        data_inicio as string | undefined,
        data_fim as string | undefined,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="contas_pagar${periodoStr}.pdf"`,
      );
      return res.end(buffer);
    }

    // Excel
    const buffer = await gerarExcel(
      rows,
      data_inicio as string | undefined,
      data_fim as string | undefined,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contas_pagar${periodoStr}.xlsx"`,
    );
    return res.end(buffer);
  } catch (error: any) {
    console.error('Erro ao gerar relatório de contas a pagar:', error);
    return res.status(500).json({
      erro: 'Erro interno ao gerar relatório',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

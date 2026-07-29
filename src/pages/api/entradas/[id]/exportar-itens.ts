import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * GET /api/entradas/[id]/exportar-itens?formato=excel|pdf
 *
 * Exporta TODOS os itens de UMA entrada (modelo Delphi "Copiar para o Excel"),
 * em Excel ou PDF. Colunas espelham o grid de itens da entrada.
 */
const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id, formato = 'excel' } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID (codent) da entrada é obrigatório' });
  }
  const fmt = String(formato).toLowerCase() === 'pdf' ? 'pdf' : 'excel';

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Cabeçalho da entrada
    const headRes = await client.query(
      `SELECT e.codent, e.dtent, e.totalnf, nfe.nnf AS nfe_numero,
              COALESCE(emit.xnome, 'SISTEMA') AS fornecedor_nome
         FROM db_manaus.dbent e
         LEFT JOIN db_manaus.dbnfe_ent nfe ON nfe.chave = e.chave
         LEFT JOIN db_manaus.dbnfe_ent_emit emit ON emit.codnfe_ent = nfe.codnfe_ent
        WHERE e.codent = $1`,
      [id]
    );
    if (headRes.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada não encontrada' });
    }
    const h = headRes.rows[0];

    // Itens (mesma consulta da tela de itens)
    const itensRes = await client.query(
      `SELECT
         ie.codprod,
         ie.codreq,
         COALESCE(p.descr, 'Produto nao encontrado') AS produto_descricao,
         COALESCE(p.ref, '') AS referencia,
         COALESCE(ie.quantant, 0) AS estoque_anterior,
         ie.quant,
         ie.prunit,
         COALESCE(ie.prcusto, 0) AS custo,
         ROUND(COALESCE(ie.quant,0) * COALESCE(ie.prunit,0), 2) AS valor_total,
         COALESCE(p.unimed, 'UN') AS unimed,
         (
           SELECT STRING_AGG(ca.arm_descricao || ': ' || ia.qtd::text, ', ' ORDER BY ca.arm_descricao)
           FROM db_manaus.dbitent_armazem ia
           JOIN db_manaus.cad_armazem ca ON ca.arm_id = ia.arm_id
           WHERE ia.codent = ie.codent AND ia.codprod = ie.codprod
             AND COALESCE(ia.codreq,'') = COALESCE(ie.codreq,'')
         ) AS armazens
       FROM db_manaus.dbitent ie
       LEFT JOIN db_manaus.dbprod p ON ie.codprod = p.codprod
       WHERE ie.codent = $1
       ORDER BY ie.codprod ASC`,
      [id]
    );
    const itens = itensRes.rows;

    const dataFmt = h.dtent ? new Date(h.dtent).toLocaleDateString('pt-BR') : '';
    const numeroNF = h.nfe_numero || h.codent;
    const tituloEntrada = `Entrada ${h.codent} — NF ${numeroNF} — ${h.fornecedor_nome} — ${dataFmt}`;
    const nomeArquivo = `entrada-${h.codent}`;

    const colunas = [
      { header: 'Referência', key: 'referencia', width: 16 },
      { header: 'Descrição', key: 'produto_descricao', width: 40 },
      { header: 'Ordem de Compra', key: 'ordem_compra', width: 18 },
      { header: 'Est. Ant.', key: 'estoque_anterior', width: 12 },
      { header: 'Qtd', key: 'quantidade', width: 10 },
      { header: 'Unid.', key: 'unimed', width: 8 },
      { header: 'Preço Unit.', key: 'valor_unitario', width: 14 },
      { header: 'Custo', key: 'custo', width: 14 },
      { header: 'Total', key: 'valor_total', width: 16 },
      { header: 'Armazéns', key: 'armazens', width: 28 },
    ];

    const linhas = itens.map((it) => ({
      referencia: it.referencia || it.codprod,
      produto_descricao: it.produto_descricao,
      ordem_compra: it.codreq || '',
      estoque_anterior: Number(it.estoque_anterior),
      quantidade: Number(it.quant),
      unimed: it.unimed || 'UN',
      valor_unitario: Number(it.prunit),
      custo: Number(it.custo),
      valor_total: Number(it.valor_total),
      armazens: it.armazens || '',
    }));

    const totalGeral = linhas.reduce((acc, l) => acc + l.valor_total, 0);

    // ===== PDF =====
    if (fmt === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(12);
      doc.text('Itens da Entrada', 40, 36);
      doc.setFontSize(9);
      doc.text(tituloEntrada, 40, 52);

      autoTable(doc, {
        startY: 64,
        head: [colunas.map((c) => c.header)],
        body: linhas.map((l) => [
          l.referencia,
          l.produto_descricao,
          l.ordem_compra,
          l.estoque_anterior.toLocaleString('pt-BR'),
          l.quantidade.toLocaleString('pt-BR'),
          l.unimed,
          moeda(l.valor_unitario),
          moeda(l.custo),
          moeda(l.valor_total),
          l.armazens,
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [52, 122, 182], textColor: 255, fontSize: 7 },
        columnStyles: {
          3: { halign: 'right' }, 4: { halign: 'right' },
          6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 80;
      doc.setFontSize(9);
      doc.text(`Total geral: ${moeda(totalGeral)}   ·   ${linhas.length} item(ns)`, 40, finalY + 18);

      const pdf = Buffer.from(doc.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.pdf`);
      res.setHeader('Content-Length', pdf.byteLength);
      return res.status(200).send(pdf);
    }

    // ===== Excel =====
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`Entrada ${h.codent}`.slice(0, 31));

    ws.mergeCells(1, 1, 1, colunas.length);
    ws.getCell(1, 1).value = tituloEntrada;
    ws.getCell(1, 1).font = { bold: true, size: 12 };
    ws.addRow([]);

    ws.columns = colunas.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    // Recoloca o header na linha 3 (as duas primeiras são título/espaço)
    const headerRow = ws.getRow(3);
    colunas.forEach((c, i) => (headerRow.getCell(i + 1).value = c.header));
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF347AB6' } };
    headerRow.eachCell((cell) => (cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }));

    linhas.forEach((l) => {
      ws.addRow([
        l.referencia, l.produto_descricao, l.ordem_compra, l.estoque_anterior,
        l.quantidade, l.unimed, l.valor_unitario, l.custo, l.valor_total, l.armazens,
      ]);
    });

    // Formato moeda nas colunas de valor (7=PrUnit, 8=Custo, 9=Total)
    [7, 8, 9].forEach((col) => {
      ws.getColumn(col).numFmt = 'R$ #,##0.00';
    });

    const totalRow = ws.addRow(['', '', '', '', '', '', '', 'Total:', totalGeral, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(9).numFmt = 'R$ #,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const xlsxBuf = Buffer.from(buffer as ArrayBuffer);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.xlsx`);
    res.setHeader('Content-Length', xlsxBuf.byteLength);
    return res.status(200).send(xlsxBuf);
  } catch (error) {
    console.error('Erro ao exportar itens da entrada:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    });
  } finally {
    if (client) client.release();
  }
}

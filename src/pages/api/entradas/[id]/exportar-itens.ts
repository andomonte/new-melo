import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLogoMeloBase64, ajustarProporcao } from '@/lib/compras/logoRelatorio';
import { getLogoFornecedorBase64 } from '@/lib/compras/logoFornecedor';

/**
 * GET /api/entradas/[id]/exportar-itens?formato=excel|pdf&colunas=ref,descr,...
 *
 * Exporta os itens de UMA entrada (modelo Delphi "Copiar para o Excel") em
 * Excel ou PDF, com logos da Melo (esquerda) e do fornecedor (direita) no
 * cabeçalho — mesma estrutura do PDF da Ordem de Compra. As colunas do
 * relatório podem ser escolhidas via `colunas` (chaves separadas por vírgula).
 */
const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type TipoColuna = 'texto' | 'numero' | 'moeda';

// Todas as colunas disponíveis (a ordem aqui é a ordem no relatório).
const TODAS_COLUNAS: { key: string; header: string; width: number; tipo: TipoColuna }[] = [
  { key: 'referencia', header: 'Referência', width: 16, tipo: 'texto' },
  { key: 'produto_descricao', header: 'Descrição', width: 40, tipo: 'texto' },
  { key: 'ordem_compra', header: 'Ordem de Compra', width: 18, tipo: 'texto' },
  { key: 'estoque_anterior', header: 'Est. Ant.', width: 12, tipo: 'numero' },
  { key: 'quantidade', header: 'Qtd', width: 10, tipo: 'numero' },
  { key: 'unimed', header: 'Unid.', width: 8, tipo: 'texto' },
  { key: 'valor_unitario', header: 'Preço Unit.', width: 14, tipo: 'moeda' },
  { key: 'custo', header: 'Custo', width: 14, tipo: 'moeda' },
  { key: 'valor_total', header: 'Total', width: 16, tipo: 'moeda' },
  { key: 'armazens', header: 'Armazéns', width: 28, tipo: 'texto' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id, formato = 'excel', colunas: colunasParam } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID (codent) da entrada é obrigatório' });
  }
  const fmt = String(formato).toLowerCase() === 'pdf' ? 'pdf' : 'excel';

  // Colunas selecionadas — preserva a ORDEM enviada pelo usuário (o modal
  // permite reordenar com setas). Sem seleção = todas na ordem canônica.
  let colunas = TODAS_COLUNAS;
  if (colunasParam) {
    const mapa = new Map(TODAS_COLUNAS.map((c) => [c.key, c]));
    const ordenadas = String(colunasParam)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((key) => mapa.get(key))
      .filter((c): c is (typeof TODAS_COLUNAS)[number] => Boolean(c));
    if (ordenadas.length > 0) colunas = ordenadas;
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Cabeçalho da entrada (inclui cod_credor para a logo do fornecedor)
    const headRes = await client.query(
      `SELECT e.codent, e.dtent, e.totalnf, e.cod_credor, nfe.nnf AS nfe_numero,
              COALESCE(emit.xnome, 'SISTEMA') AS fornecedor_nome
         FROM dbent e
         LEFT JOIN dbnfe_ent nfe ON nfe.chave = e.chave
         LEFT JOIN dbnfe_ent_emit emit ON emit.codnfe_ent = nfe.codnfe_ent
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
           FROM dbitent_armazem ia
           JOIN cad_armazem ca ON ca.arm_id = ia.arm_id
           WHERE ia.codent = ie.codent AND ia.codprod = ie.codprod
             AND COALESCE(ia.codreq,'') = COALESCE(ie.codreq,'')
         ) AS armazens
       FROM dbitent ie
       LEFT JOIN dbprod p ON ie.codprod = p.codprod
       WHERE ie.codent = $1
       ORDER BY ie.codprod ASC`,
      [id]
    );
    const itens = itensRes.rows;

    const dataFmt = h.dtent ? new Date(h.dtent).toLocaleDateString('pt-BR') : '';
    const numeroNF = h.nfe_numero || h.codent;
    const tituloEntrada = `Entrada ${h.codent} — NF ${numeroNF} — ${h.fornecedor_nome} — ${dataFmt}`;
    const nomeArquivo = `entrada-${h.codent}`;

    // Logos: Melo (fixa) + fornecedor (por cod_credor)
    const logoMelo = getLogoMeloBase64();
    const logoForn = await getLogoFornecedorBase64(client, h.cod_credor);

    // Valor bruto de cada linha (por chave)
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
    })) as Record<string, any>[];

    const totalGeral = linhas.reduce((acc, l) => acc + Number(l.valor_total || 0), 0);
    const idxTotal = colunas.findIndex((c) => c.key === 'valor_total');

    // ===== PDF =====
    if (fmt === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margem = 40;

      // Cabeçalho com logos (Melo à esquerda, fornecedor à direita) — mesma
      // estrutura da Ordem de Compra, em caixa de mesmo tamanho.
      const LOGO_MAXW = 150;
      const LOGO_MAXH = 50;
      const yLogo = 24;
      if (logoMelo) {
        try {
          const { w, h: hh } = ajustarProporcao(logoMelo.largura || LOGO_MAXW, logoMelo.altura || LOGO_MAXH, LOGO_MAXW, LOGO_MAXH);
          doc.addImage(`data:image/png;base64,${logoMelo.base64}`, 'PNG', margem, yLogo + (LOGO_MAXH - hh) / 2, w, hh);
        } catch (e) {
          console.log('Erro ao inserir logo Melo no PDF:', e);
        }
      }
      if (logoForn?.base64) {
        try {
          const { w, h: hh } = ajustarProporcao(logoForn.largura || LOGO_MAXW, logoForn.altura || LOGO_MAXH, LOGO_MAXW, LOGO_MAXH);
          doc.addImage(`data:image/png;base64,${logoForn.base64}`, 'PNG', pageW - margem - w, yLogo + (LOGO_MAXH - hh) / 2, w, hh);
        } catch (e) {
          console.log('Erro ao inserir logo do fornecedor no PDF:', e);
        }
      }

      let y = yLogo + LOGO_MAXH + 20;
      doc.setFontSize(12);
      doc.setTextColor(41, 84, 144);
      doc.text('Itens da Entrada', margem, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(tituloEntrada, margem, y + 14);

      const formatarCelula = (l: Record<string, any>, tipo: TipoColuna, key: string) => {
        const v = l[key];
        if (tipo === 'moeda') return moeda(Number(v));
        if (tipo === 'numero') return Number(v).toLocaleString('pt-BR');
        return String(v ?? '');
      };

      const columnStyles: Record<number, any> = {};
      colunas.forEach((c, i) => {
        if (c.tipo === 'numero' || c.tipo === 'moeda') columnStyles[i] = { halign: 'right' };
      });

      autoTable(doc, {
        startY: y + 26,
        head: [colunas.map((c) => c.header)],
        body: linhas.map((l) => colunas.map((c) => formatarCelula(l, c.tipo, c.key))),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [52, 122, 182], textColor: 255, fontSize: 7 },
        columnStyles,
      });

      const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
      doc.setFontSize(9);
      doc.text(`Total geral: ${moeda(totalGeral)}   ·   ${linhas.length} item(ns)`, margem, finalY + 18);

      const pdf = Buffer.from(doc.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.pdf`);
      res.setHeader('Content-Length', pdf.byteLength);
      return res.status(200).send(pdf);
    }

    // ===== Excel =====
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`Entrada ${h.codent}`.slice(0, 31));

    // Larguras das colunas
    colunas.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

    // Reserva as 3 primeiras linhas para os logos
    ws.getRow(1).height = 20;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 16;

    if (logoMelo) {
      try {
        const { w, h: hh } = ajustarProporcao(logoMelo.largura || 150, logoMelo.altura || 50, 150, 50);
        const imgId = workbook.addImage({ base64: logoMelo.base64, extension: 'png' });
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: w, height: hh } });
      } catch (e) {
        console.log('Erro ao inserir logo Melo no Excel:', e);
      }
    }
    if (logoForn?.base64) {
      try {
        const { w, h: hh } = ajustarProporcao(logoForn.largura || 150, logoForn.altura || 50, 150, 50);
        const imgId = workbook.addImage({ base64: logoForn.base64, extension: 'png' });
        // Ancorado nas últimas colunas (canto direito)
        const colDir = Math.max(0, colunas.length - 2);
        ws.addImage(imgId, { tl: { col: colDir, row: 0 }, ext: { width: w, height: hh } });
      } catch (e) {
        console.log('Erro ao inserir logo do fornecedor no Excel:', e);
      }
    }

    // Título na linha 4
    ws.mergeCells(4, 1, 4, colunas.length);
    ws.getCell(4, 1).value = tituloEntrada;
    ws.getCell(4, 1).font = { bold: true, size: 12 };

    // Cabeçalho na linha 5
    const headerRow = ws.getRow(5);
    colunas.forEach((c, i) => (headerRow.getCell(i + 1).value = c.header));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF347AB6' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Dados a partir da linha 6
    let linhaAtual = 6;
    linhas.forEach((l) => {
      const row = ws.getRow(linhaAtual++);
      colunas.forEach((c, i) => (row.getCell(i + 1).value = l[c.key]));
    });

    // Formato moeda nas colunas de valor
    colunas.forEach((c, i) => {
      if (c.tipo === 'moeda') ws.getColumn(i + 1).numFmt = 'R$ #,##0.00';
    });

    // Linha de total (só se a coluna Total estiver selecionada)
    if (idxTotal >= 0) {
      const totalRow = ws.getRow(linhaAtual++);
      if (idxTotal > 0) totalRow.getCell(idxTotal).value = 'Total:';
      const cell = totalRow.getCell(idxTotal + 1);
      cell.value = totalGeral;
      cell.numFmt = 'R$ #,##0.00';
      totalRow.font = { bold: true };
    }

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

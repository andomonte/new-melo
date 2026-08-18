import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseCookies } from 'nookies';
import ExcelJS from 'exceljs';

/**
 * POST /api/vendas/orcamento-pdf/gerar-excel
 * Body: { draft_id, codvenda }
 * Retorna: arquivo .xlsx direto (stream)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { draft_id, codvenda } = req.body;
  if (!draft_id && !codvenda) {
    return res.status(400).json({ error: 'draft_id ou codvenda é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || '1';
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Buscar draft
    const resultDraft = await client.query(
      `SELECT d.draft_id, d.payload, d.total, d.cliente_nome, d.created_at, d.codvend, d.codcli
       FROM dbvenda_draft d WHERE d.draft_id = $1 AND d.filial = $2`,
      [draft_id, filial],
    );
    if (resultDraft.rows.length === 0) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    const draft = resultDraft.rows[0];
    const payload = draft.payload || {};
    const header = payload.header || {};
    const itens = payload.itens || [];
    const codcli = header.codcli || draft.codcli;

    // Buscar cliente
    let clienteNome = draft.cliente_nome || header.nomecf || '';
    let clienteCnpj = '';
    if (codcli) {
      const rc = await client.query('SELECT nome, cpfcgc FROM dbclien WHERE codcli = $1', [codcli]);
      if (rc.rows.length > 0) {
        clienteNome = rc.rows[0].nome || clienteNome;
        clienteCnpj = rc.rows[0].cpfcgc || '';
      }
    }

    // Buscar vendedor
    let vendedorNome = '';
    const codVendedor = header.codvend || draft.codvend;
    if (codVendedor) {
      const rv = await client.query('SELECT nome FROM dbvend WHERE codvend = $1', [codVendedor]);
      if (rv.rows.length > 0) vendedorNome = rv.rows[0].nome || '';
    }

    // Processar itens
    const itensProcessados = [];
    for (const item of itens) {
      const codprod = item.codprod || item.codigo;
      let ref = item.ref || '';
      let descr = item.descr || item.descricao || item.nome || '';
      let ncm = '';

      if (codprod) {
        const rp = await client.query('SELECT ref, descr, clasfiscal as ncm FROM dbprod WHERE codprod = $1', [codprod]);
        if (rp.rows.length > 0) {
          ref = ref || rp.rows[0].ref || '';
          if (!descr) descr = rp.rows[0].descr || '';
          ncm = rp.rows[0].ncm || '';
        }
      }

      const qtd = Number(item.qtd || item.quantidade || 0);
      const prunit = Number(item.prunit || item.precoItemEditado || item.preco || 0);
      const desconto = Number(item.desconto || 0);
      const totalItem = qtd * prunit * (1 - desconto / 100);

      const icmsValor = Number(item.impostos?.valorICMS || item.campos?.totalicms || 0);
      const ipiValor = Number(item.impostos?.valorIPI || item.campos?.totalipi || 0);
      const pisValor = Number(item.impostos?.valorPIS || item.campos?.valorpis || 0);
      const cofinsValor = Number(item.impostos?.valorCOFINS || item.campos?.valorcofins || 0);
      const stValor = Number(item.impostos?.valorICMS_Subst || item.campos?.totalsubst_trib || 0);
      const totalComImp = totalItem + ipiValor + stValor;

      itensProcessados.push({ ref, descr, ncm: ncm || item.campos?.ncm || item.ncm || '', qtd, prunit, desconto, totalItem, icmsValor, ipiValor, stValor, pisValor, cofinsValor, totalComImp });
    }

    // Gerar Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Orçamento');

    // Cabeçalho
    const dataOrc = new Date(draft.created_at).toLocaleDateString('pt-BR');
    ws.mergeCells('A1:M1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'ORÇAMENTO';
    titleCell.font = { bold: true, size: 16, color: { argb: '003366' } };
    titleCell.alignment = { horizontal: 'center' };

    ws.getCell('A3').value = 'Nº:'; ws.getCell('B3').value = codvenda || draft_id;
    ws.getCell('D3').value = 'Data:'; ws.getCell('E3').value = dataOrc;
    ws.getCell('A4').value = 'Cliente:'; ws.getCell('B4').value = clienteNome;
    if (clienteCnpj) { ws.getCell('G4').value = 'CNPJ/CPF:'; ws.getCell('H4').value = clienteCnpj; }
    if (vendedorNome) { ws.getCell('A5').value = 'Vendedor:'; ws.getCell('B5').value = vendedorNome; }

    ['A3','A4','A5','D3','G4'].forEach(c => { const cell = ws.getCell(c); cell.font = { bold: true, size: 10 }; });

    // Tabela de itens - Header
    const headerRow = 7;
    const headers = ['REF', 'DESCRIÇÃO', 'NCM', 'QTD', 'UNIT.', 'DESC%', 'SUBTOTAL', 'ICMS', 'IPI', 'ST', 'PIS', 'COFINS', 'TOTAL'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '003366' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Dados
    let totalGeral = 0, totalIcms = 0, totalIpi = 0, totalSt = 0, totalPis = 0, totalCofins = 0, totalComImpGeral = 0;
    itensProcessados.forEach((item, idx) => {
      const row = headerRow + 1 + idx;
      ws.getCell(row, 1).value = item.ref;
      ws.getCell(row, 2).value = item.descr;
      ws.getCell(row, 3).value = item.ncm || '-';
      ws.getCell(row, 4).value = item.qtd;
      ws.getCell(row, 5).value = item.prunit;
      ws.getCell(row, 6).value = item.desconto > 0 ? item.desconto : null;
      ws.getCell(row, 7).value = item.totalItem;
      ws.getCell(row, 8).value = item.icmsValor || null;
      ws.getCell(row, 9).value = item.ipiValor || null;
      ws.getCell(row, 10).value = item.stValor || null;
      ws.getCell(row, 11).value = item.pisValor || null;
      ws.getCell(row, 12).value = item.cofinsValor || null;
      ws.getCell(row, 13).value = item.totalComImp;

      // Formato moeda
      [5,7,8,9,10,11,12,13].forEach(c => { ws.getCell(row, c).numFmt = '#,##0.00'; });
      [6].forEach(c => { if (ws.getCell(row, c).value) ws.getCell(row, c).numFmt = '0.0"%"'; });

      // Bordas
      for (let c = 1; c <= 13; c++) {
        ws.getCell(row, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }

      totalGeral += item.totalItem;
      totalIcms += item.icmsValor;
      totalIpi += item.ipiValor;
      totalSt += item.stValor;
      totalPis += item.pisValor;
      totalCofins += item.cofinsValor;
      totalComImpGeral += item.totalComImp;
    });

    // Linha de totais
    const totRow = headerRow + 1 + itensProcessados.length;
    ws.getCell(totRow, 6).value = 'TOTAIS:';
    ws.getCell(totRow, 6).font = { bold: true, size: 10 };
    ws.getCell(totRow, 7).value = totalGeral;
    ws.getCell(totRow, 8).value = totalIcms || null;
    ws.getCell(totRow, 9).value = totalIpi || null;
    ws.getCell(totRow, 10).value = totalSt || null;
    ws.getCell(totRow, 11).value = totalPis || null;
    ws.getCell(totRow, 12).value = totalCofins || null;
    ws.getCell(totRow, 13).value = totalComImpGeral;
    [7,8,9,10,11,12,13].forEach(c => {
      const cell = ws.getCell(totRow, c);
      cell.numFmt = '#,##0.00';
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6F0FA' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Larguras das colunas
    ws.getColumn(1).width = 14;  // REF
    ws.getColumn(2).width = 40;  // DESCRIÇÃO
    ws.getColumn(3).width = 12;  // NCM
    ws.getColumn(4).width = 8;   // QTD
    ws.getColumn(5).width = 12;  // UNIT
    ws.getColumn(6).width = 10;  // DESC%
    ws.getColumn(7).width = 14;  // SUBTOTAL
    ws.getColumn(8).width = 12;  // ICMS
    ws.getColumn(9).width = 10;  // IPI
    ws.getColumn(10).width = 10; // ST
    ws.getColumn(11).width = 10; // PIS
    ws.getColumn(12).width = 12; // COFINS
    ws.getColumn(13).width = 14; // TOTAL

    // Nome do arquivo
    const now = new Date();
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');
    const codcliSafe = String(codcli || 'sem_cliente').replace(/[^a-zA-Z0-9_-]/g, '');
    const nomeArquivo = `venda_${codcliSafe}_${ts}.xlsx`;

    // Enviar como download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    const buffer = await wb.xlsx.writeBuffer();
    return res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (error: any) {
    console.error('Erro ao gerar Excel:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

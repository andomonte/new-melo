/**
 * PDF do Comprovante de Pagamento via jsPDF + autoTable (server-side, SEM puppeteer/Chrome).
 * Mesmo conteúdo do layout do web. Usado no envio por email (deploy não tem Chrome).
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ItemComprovantePdf {
  ita_nro_doc?: string | null;
  valor_original?: number | null;
  ita_valor_juros?: number | null;
  taxa_admin?: number | null;
  ita_valor_total?: number | null;
  ita_valor?: number | null;
  ita_valo_areceber?: number | null;
}
export interface FormaPdf {
  nome?: string | null;
  valor?: number | null;
}
export interface ComprovantePdfData {
  aut_id: string;
  aut_data: string;
  aut_autenticacao?: string | null;
  aut_cancel?: number | null;
  codcli?: string | number | null;
  nome_cliente?: string | null;
  itens: ItemComprovantePdf[];
  formas: FormaPdf[];
}

const num = (n: any) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

/** @param logoDataUrl data:image/png;base64,... (opcional) */
export function gerarComprovantePdf(d: ComprovantePdfData, logoDataUrl?: string): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Cabeçalho ──
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 12, 10, 52, 15, undefined, 'FAST');
    } catch {
      /* sem logo */
    }
  }
  // Caixa do cliente (centro)
  doc.setDrawColor(0);
  doc.rect(78, 9, 78, 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente', 80, 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`${d.codcli || ''} - ${(d.nome_cliente || '').substring(0, 42)}`, 80, 18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Data: ${fmtData(d.aut_data)}`, 80, 24);

  // Nº + autenticação (direita)
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text(String(d.aut_id), pageW - 12, 15, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(String(d.aut_autenticacao || ''), pageW - 12, 20, { align: 'right' });

  // ── Título ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const cancelado = Number(d.aut_cancel) === 1 ? '   (CANCELADO)' : '';
  doc.text(`COMPROVANTE DE PAGAMENTO${cancelado}`, pageW / 2, 34, { align: 'center' });

  // ── Tabela de títulos ──
  const body = (d.itens || []).map((i, idx) => {
    const original = i.valor_original != null ? i.valor_original : i.ita_valo_areceber;
    return [
      String(idx + 1),
      i.ita_nro_doc || '-',
      num(original),
      num(i.ita_valor_juros),
      num(i.taxa_admin),
      num(i.ita_valor_total),
      num(i.ita_valor_total),
      num(i.ita_valor),
    ];
  });
  const totalRecebido = (d.itens || []).reduce((s, i) => s + Number(i.ita_valor || 0), 0);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Título', 'Valor Original', 'Valor do Juros', 'Taxa Admin.', 'Valor Total¹', 'Valor Total a Pagar¹', 'Valor Pago']],
    body,
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    theme: 'grid',
    margin: { left: 12, right: 12 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // ── Formas de pagamento ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FORMAS DE PAGAMENTO', 12, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    body:
      (d.formas || []).length > 0
        ? d.formas.map((f) => [(f.nome || '-').toUpperCase(), num(f.valor)])
        : [['—', '']],
    styles: { fontSize: 8, cellPadding: 1.2 },
    columnStyles: { 1: { halign: 'right' } },
    theme: 'grid',
    margin: { left: 12, right: pageW / 2 },
    tableWidth: pageW / 2 - 12,
  });

  // ── Total Recebido (rodapé) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total Recebido:', pageW - 62, pageH - 34, { align: 'right' });
  doc.rect(pageW - 60, pageH - 39, 48, 7);
  doc.text(num(totalRecebido), pageW - 14, pageH - 34, { align: 'right' });

  // ── Notas de rodapé ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('¹ Valor atualizado até o dia ' + fmtData(d.aut_data) + '.', 12, pageH - 22);
  doc.text('² Pagamento efetuado com cheque ou cheque-pré está sujeito a compensação.', 12, pageH - 18);
  doc.text('(*) Pagamento realizado parcialmente.', 12, pageH - 14);
  doc.text('Impresso em ' + new Date().toLocaleString('pt-BR'), pageW - 12, pageH - 14, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

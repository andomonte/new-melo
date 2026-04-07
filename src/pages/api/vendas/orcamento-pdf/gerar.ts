import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseCookies } from 'nookies';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Estende jsPDF para incluir lastAutoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface AliquotasProduto {
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  ncm: string;
}

interface ItemOrcamento {
  codprod: string;
  ref: string;
  descr: string;
  qtd: number;
  prunit: number;
  desconto: number;
  total: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_aliquota: number;
  ipi_valor: number;
  pis_aliquota: number;
  pis_valor: number;
  cofins_aliquota: number;
  cofins_valor: number;
  ncm: string;
}

interface DadosOrcamento {
  draft_id: string;
  codvenda: string;
  data: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  cliente_endereco?: string;
  cliente_cidade?: string;
  cliente_uf?: string;
  vendedor_nome?: string;
  prazo?: string;
  obs?: string;
  total: number;
  itens: ItemOrcamento[];
  total_icms: number;
  total_ipi: number;
  total_pis: number;
  total_cofins: number;
  total_impostos: number;
}

// Pasta para armazenar PDFs temporários
// No Vercel, apenas /tmp é gravável. Em desenvolvimento, usa pasta local.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const PDF_TEMP_DIR = isVercel
  ? '/tmp'
  : path.join(process.cwd(), 'tmp', 'orcamentos');

// Garantir que a pasta existe (apenas em desenvolvimento)
function ensureTempDir() {
  try {
    if (!isVercel && !fs.existsSync(PDF_TEMP_DIR)) {
      fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
    }
  } catch (e) {
    console.log('Aviso: Não foi possível criar diretório temp:', e);
  }
}

// Limpar PDFs antigos (mais de 1 hora no Vercel, 24h em dev)
function cleanOldPdfs() {
  try {
    if (!fs.existsSync(PDF_TEMP_DIR)) return;

    const files = fs.readdirSync(PDF_TEMP_DIR);
    const now = Date.now();
    const maxAge = isVercel ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1h no Vercel, 24h em dev

    files.forEach((file) => {
      // Apenas limpar arquivos de orçamento
      if (!file.startsWith('orcamento_')) return;

      try {
        const filePath = path.join(PDF_TEMP_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Ignora erros de arquivos individuais
      }
    });
  } catch (e) {
    // Ignora erros de limpeza no Vercel (read-only em algumas situações)
    if (!isVercel) {
      console.error('Erro ao limpar PDFs antigos:', e);
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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
    // Limpar PDFs antigos em background
    cleanOldPdfs();

    // Buscar dados do draft
    const queryDraft = `
      SELECT
        d.draft_id,
        d.payload,
        d.total,
        d.cliente_nome,
        d.created_at,
        d.codvend,
        d.codcli
      FROM dbvenda_draft d
      WHERE d.draft_id = $1 AND d.filial = $2
    `;

    const resultDraft = await client.query(queryDraft, [draft_id, filial]);

    if (resultDraft.rows.length === 0) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    const draft = resultDraft.rows[0];
    const payload = draft.payload || {};
    const header = payload.header || {};
    const itens = payload.itens || [];

    // Buscar dados do cliente
    let clienteNome = draft.cliente_nome || header.nomecf || '';
    let clienteCnpj = '';
    let clienteEndereco = '';
    let clienteCidade = '';
    let clienteUf = '';
    const codcli = header.codcli || draft.codcli;

    if (codcli) {
      const queryCliente = `
        SELECT nome, cpfcgc, ender, cidade, uf
        FROM dbclien
        WHERE codcli = $1
      `;
      const resultCliente = await client.query(queryCliente, [codcli]);
      if (resultCliente.rows.length > 0) {
        const cli = resultCliente.rows[0];
        clienteNome = cli.nome || clienteNome;
        clienteCnpj = cli.cpfcgc || '';
        clienteEndereco = cli.ender || '';
        clienteCidade = cli.cidade || '';
        clienteUf = cli.uf || '';
      }
    }

    // Buscar nome do vendedor
    let vendedorNome = '';
    if (header.codvend || draft.codvend) {
      const codVendedor = header.codvend || draft.codvend;
      const queryVendedor = `
        SELECT nome FROM dbvend WHERE codvend = $1
      `;
      const resultVendedor = await client.query(queryVendedor, [codVendedor]);
      if (resultVendedor.rows.length > 0) {
        vendedorNome = resultVendedor.rows[0].nome || '';
      }
    }

    // Processar itens e calcular impostos
    const itensProcessados: ItemOrcamento[] = [];
    let totalIcms = 0;
    let totalIpi = 0;
    let totalPis = 0;
    let totalCofins = 0;

    for (const item of itens) {
      const codprod = item.codprod || item.codigo;
      let ref = item.ref || '';
      let descr = item.descr || item.nome || '';
      let aliquotas: AliquotasProduto = {
        icms: 0,
        ipi: 0,
        pis: 0,
        cofins: 0,
        ncm: '',
      };

      if (codprod) {
        const queryProd = `
          SELECT
            p.ref,
            p.descr,
            p.clasfiscal as ncm,
            COALESCE(p.ipi, 0) as ipi,
            COALESCE(p.pis, 1.65) as pis,
            COALESCE(p.cofins, 7.60) as cofins
          FROM dbprod p
          WHERE p.codprod = $1
        `;
        const resultProd = await client.query(queryProd, [codprod]);
        if (resultProd.rows.length > 0) {
          const prod = resultProd.rows[0];
          ref = prod.ref || ref || '';
          if (!descr) descr = prod.descr || '';
          aliquotas = {
            icms: 18,
            ipi: Number(prod.ipi) || 0,
            pis: Number(prod.pis) || 1.65,
            cofins: Number(prod.cofins) || 7.6,
            ncm: prod.ncm || '',
          };
        }
      }

      const qtd = Number(item.qtd || item.quantidade || 0);
      const prunit = Number(item.prunit || item.precoItemEditado || item.preco || 0);
      const desconto = Number(item.desconto || 0);
      const totalItem = qtd * prunit * (1 - desconto / 100);

      const baseCalculo = totalItem;
      const icmsValor = baseCalculo * (aliquotas.icms / 100);
      const ipiValor = baseCalculo * (aliquotas.ipi / 100);
      const pisValor = baseCalculo * (aliquotas.pis / 100);
      const cofinsValor = baseCalculo * (aliquotas.cofins / 100);

      totalIcms += icmsValor;
      totalIpi += ipiValor;
      totalPis += pisValor;
      totalCofins += cofinsValor;

      itensProcessados.push({
        codprod: codprod || '',
        ref: ref || codprod || '',
        descr: descr,
        qtd,
        prunit,
        desconto,
        total: totalItem,
        icms_aliquota: aliquotas.icms,
        icms_valor: icmsValor,
        ipi_aliquota: aliquotas.ipi,
        ipi_valor: ipiValor,
        pis_aliquota: aliquotas.pis,
        pis_valor: pisValor,
        cofins_aliquota: aliquotas.cofins,
        cofins_valor: cofinsValor,
        ncm: aliquotas.ncm,
      });
    }

    const totalImpostos = totalIcms + totalIpi + totalPis + totalCofins;

    const dadosOrcamento: DadosOrcamento = {
      draft_id,
      codvenda: codvenda || draft_id,
      data: new Date(draft.created_at).toLocaleDateString('pt-BR'),
      cliente_nome: clienteNome,
      cliente_cnpj: clienteCnpj,
      cliente_endereco: clienteEndereco,
      cliente_cidade: clienteCidade,
      cliente_uf: clienteUf,
      vendedor_nome: vendedorNome,
      prazo: header.prazo || '',
      obs: header.obs || '',
      total: Number(draft.total || 0),
      itens: itensProcessados,
      total_icms: totalIcms,
      total_ipi: totalIpi,
      total_pis: totalPis,
      total_cofins: totalCofins,
      total_impostos: totalImpostos,
    };

    // ============= GERAR PDF =============
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Carregar logo da empresa
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'images', 'logoPdf.png');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (e) {
      console.log('Logo não encontrado, continuando sem logo');
    }

    // Cabeçalho com logo e título ORÇAMENTO
    let headerY = 15;
    if (logoBase64) {
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 14, 8, 60, 25);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('ORÇAMENTO', pageWidth - 14, 22, { align: 'right' });
      headerY = 36;
    } else {
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('ORÇAMENTO', pageWidth / 2, 20, { align: 'center' });
      headerY = 28;
    }

    // Linha separadora
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(14, headerY, pageWidth - 14, headerY);

    // Número e Data
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Nº: ${dadosOrcamento.codvenda}`, 14, headerY + 8);
    doc.text(`Data: ${dadosOrcamento.data}`, pageWidth - 14, headerY + 8, { align: 'right' });

    // Dados do cliente
    let currentY = headerY + 16;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(dadosOrcamento.cliente_nome || 'Não informado', 35, currentY);

    if (dadosOrcamento.cliente_cnpj) {
      currentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('CNPJ/CPF:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(dadosOrcamento.cliente_cnpj, 40, currentY);
    }

    if (dadosOrcamento.cliente_endereco) {
      currentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Endereço:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      const enderecoCompleto = `${dadosOrcamento.cliente_endereco}${dadosOrcamento.cliente_cidade ? ' - ' + dadosOrcamento.cliente_cidade : ''}${dadosOrcamento.cliente_uf ? '/' + dadosOrcamento.cliente_uf : ''}`;
      doc.text(enderecoCompleto.substring(0, 80), 38, currentY);
    }

    if (dadosOrcamento.vendedor_nome) {
      currentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Vendedor:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(dadosOrcamento.vendedor_nome, 38, currentY);
    }

    // Tabela de itens
    const startY = currentY + 8;

    autoTable(doc, {
      startY,
      head: [['REF', 'DESCRIÇÃO', 'NCM', 'QTD', 'PREÇO UNIT.', 'ICMS%', 'IPI%', 'TOTAL']],
      body: dadosOrcamento.itens.map((item) => [
        item.ref,
        item.descr.substring(0, 35),
        item.ncm || '-',
        item.qtd.toString(),
        `R$ ${item.prunit.toFixed(2)}`,
        item.icms_aliquota > 0 ? `${item.icms_aliquota.toFixed(0)}%` : '-',
        item.ipi_aliquota > 0 ? `${item.ipi_aliquota.toFixed(0)}%` : '-',
        `R$ ${item.total.toFixed(2)}`,
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 50 },
        2: { cellWidth: 18 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 14, halign: 'center' },
        7: { cellWidth: 25, halign: 'right' },
      },
      theme: 'grid',
    });

    const finalY = doc.lastAutoTable?.finalY || startY + 50;

    // Box de totais
    const boxX = pageWidth - 90;
    const boxY = finalY + 5;
    const boxWidth = 76;

    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, boxWidth, 45);

    doc.setFillColor(0, 51, 102);
    doc.rect(boxX, boxY, boxWidth, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RESUMO DE IMPOSTOS', boxX + boxWidth / 2, boxY + 5, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let lineY = boxY + 13;
    doc.text('ICMS:', boxX + 3, lineY);
    doc.text(`R$ ${dadosOrcamento.total_icms.toFixed(2)}`, boxX + boxWidth - 3, lineY, { align: 'right' });

    lineY += 6;
    doc.text('IPI:', boxX + 3, lineY);
    doc.text(`R$ ${dadosOrcamento.total_ipi.toFixed(2)}`, boxX + boxWidth - 3, lineY, { align: 'right' });

    lineY += 6;
    doc.text('PIS:', boxX + 3, lineY);
    doc.text(`R$ ${dadosOrcamento.total_pis.toFixed(2)}`, boxX + boxWidth - 3, lineY, { align: 'right' });

    lineY += 6;
    doc.text('COFINS:', boxX + 3, lineY);
    doc.text(`R$ ${dadosOrcamento.total_cofins.toFixed(2)}`, boxX + boxWidth - 3, lineY, { align: 'right' });

    lineY += 3;
    doc.line(boxX + 2, lineY, boxX + boxWidth - 2, lineY);

    lineY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Impostos:', boxX + 3, lineY);
    doc.text(`R$ ${dadosOrcamento.total_impostos.toFixed(2)}`, boxX + boxWidth - 3, lineY, { align: 'right' });

    // Total do orçamento
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', 14, boxY + 15);
    doc.text(`R$ ${dadosOrcamento.total.toFixed(2)}`, 14, boxY + 23);

    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.text('TOTAL C/ IMPOSTOS:', 14, boxY + 35);
    const totalComImpostos = dadosOrcamento.total + dadosOrcamento.total_ipi;
    doc.text(`R$ ${totalComImpostos.toFixed(2)}`, 14, boxY + 43);

    // Condições de pagamento
    const infoY = boxY + 52;
    if (dadosOrcamento.prazo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Condições de Pagamento:', 14, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(dadosOrcamento.prazo, 62, infoY);
    }

    if (dadosOrcamento.obs) {
      const obsY = dadosOrcamento.prazo ? infoY + 8 : infoY;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Observações:', 14, obsY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(dadosOrcamento.obs, pageWidth - 28);
      doc.text(obsLines.slice(0, 3), 14, obsY + 5);
    }

    // Rodapé
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('* Valores de impostos calculados com base nas alíquotas vigentes. Sujeitos a confirmação na emissão da NF.', pageWidth / 2, pageHeight - 18, { align: 'center' });
    doc.text('Este orçamento é válido por 7 dias a partir da data de emissão. Preços sujeitos a alteração sem aviso prévio.', pageWidth / 2, pageHeight - 13, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Salvar PDF em arquivo temporário
    ensureTempDir();
    const pdfId = uuidv4();
    const pdfFileName = `orcamento_${pdfId}.pdf`;
    const pdfFilePath = path.join(PDF_TEMP_DIR, pdfFileName);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    // Retornar ID e informações do orçamento
    return res.status(200).json({
      success: true,
      pdf_id: pdfId,
      pdf_url: `/api/vendas/orcamento-pdf/${pdfId}`,
      dados: {
        codvenda: dadosOrcamento.codvenda,
        cliente_nome: dadosOrcamento.cliente_nome,
        total: dadosOrcamento.total,
        total_com_impostos: totalComImpostos,
        data: dadosOrcamento.data,
      },
      expires_in: '24 horas',
    });
  } catch (error: any) {
    console.error('Erro ao gerar PDF do orçamento:', error);
    res.status(500).json({
      error: 'Erro ao gerar PDF',
      message: error.message,
    });
  } finally {
    client.release();
  }
}

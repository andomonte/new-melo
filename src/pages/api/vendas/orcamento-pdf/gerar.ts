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
      let descr = item.descr || item.descricao || item.nome || '';
      let ncm = '';

      // Buscar ref, descr e ncm do produto se não vieram no draft
      if (codprod) {
        const queryProd = `
          SELECT p.ref, p.descr, p.clasfiscal as ncm
          FROM dbprod p WHERE p.codprod = $1
        `;
        const resultProd = await client.query(queryProd, [codprod]);
        if (resultProd.rows.length > 0) {
          const prod = resultProd.rows[0];
          ref = ref || prod.ref || '';
          if (!descr) descr = prod.descr || '';
          ncm = prod.ncm || '';
        }
      }

      const qtd = Number(item.qtd || item.quantidade || 0);
      const prunit = Number(item.prunit || item.precoItemEditado || item.preco || 0);
      const desconto = Number(item.desconto || 0);
      const totalItem = qtd * prunit * (1 - desconto / 100);

      // Usar impostos JÁ CALCULADOS do draft (campos ou impostos)
      const aliqIcms = Number(item.aliquotas?.icms || item.campos?.icms || 0);
      const aliqIpi = Number(item.aliquotas?.ipi || item.campos?.ipi || 0);
      const aliqPis = Number(item.aliquotas?.pis || item.campos?.pis || 0);
      const aliqCofins = Number(item.aliquotas?.cofins || item.campos?.cofins || 0);

      const icmsValor = Number(item.impostos?.valorICMS || item.campos?.totalicms || 0);
      const ipiValor = Number(item.impostos?.valorIPI || item.campos?.totalipi || 0);
      const pisValor = Number(item.impostos?.valorPIS || item.campos?.valorpis || 0);
      const cofinsValor = Number(item.impostos?.valorCOFINS || item.campos?.valorcofins || 0);
      const stValor = Number(item.impostos?.valorICMS_Subst || item.campos?.totalsubst_trib || 0);

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
        icms_aliquota: aliqIcms,
        icms_valor: icmsValor,
        ipi_aliquota: aliqIpi,
        ipi_valor: ipiValor,
        pis_aliquota: aliqPis,
        pis_valor: pisValor,
        cofins_aliquota: aliqCofins,
        cofins_valor: cofinsValor,
        ncm: ncm || item.campos?.ncm || item.ncm || '',
        st_valor: stValor,
      } as any);
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

    // ============= GERAR PDF — PAISAGEM =============
    const doc = new jsPDF({ orientation: 'landscape', format: 'A4' });
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
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 14, 8, 50, 20);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('ORÇAMENTO', pageWidth - 14, 20, { align: 'right' });
      headerY = 32;
    } else {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('ORÇAMENTO', pageWidth / 2, 18, { align: 'center' });
      headerY = 26;
    }

    // Linha separadora
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(14, headerY, pageWidth - 14, headerY);

    // Número, Data, Vendedor — linha única
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Nº: ${dadosOrcamento.codvenda}`, 14, headerY + 6);
    doc.text(`Data: ${dadosOrcamento.data}`, 80, headerY + 6);
    if (dadosOrcamento.vendedor_nome) {
      doc.text(`Vendedor: ${dadosOrcamento.vendedor_nome}`, 140, headerY + 6);
    }

    // Dados do cliente — linha compacta
    let currentY = headerY + 13;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    let clienteInfo = dadosOrcamento.cliente_nome || 'Não informado';
    if (dadosOrcamento.cliente_cnpj) clienteInfo += `  |  CNPJ/CPF: ${dadosOrcamento.cliente_cnpj}`;
    doc.text(clienteInfo, 38, currentY);

    if (dadosOrcamento.cliente_endereco) {
      currentY += 5;
      const enderecoCompleto = `${dadosOrcamento.cliente_endereco}${dadosOrcamento.cliente_cidade ? ' - ' + dadosOrcamento.cliente_cidade : ''}${dadosOrcamento.cliente_uf ? '/' + dadosOrcamento.cliente_uf : ''}`;
      doc.setFont('helvetica', 'normal');
      doc.text(enderecoCompleto.substring(0, 120), 14, currentY);
    }

    // Tabela de itens — com impostos por item
    const startY = currentY + 6;

    const totalComImpostos = dadosOrcamento.total + dadosOrcamento.total_ipi;

    autoTable(doc, {
      startY,
      head: [['REF', 'DESCRIÇÃO', 'NCM', 'QTD', 'UNIT.', 'DESC%', 'SUBTOTAL', 'ICMS', 'IPI', 'ST', 'PIS', 'COFINS', 'TOTAL']],
      body: dadosOrcamento.itens.map((item) => {
        const stValor = Number((item as any).st_valor || 0);
        const totalItem = item.total + item.ipi_valor + stValor;
        return [
          item.ref,
          item.descr.substring(0, 45),
          item.ncm || '-',
          item.qtd.toString(),
          item.prunit.toFixed(2),
          item.desconto > 0 ? `${item.desconto.toFixed(1)}%` : '-',
          item.total.toFixed(2),
          item.icms_valor > 0 ? item.icms_valor.toFixed(2) : '-',
          item.ipi_valor > 0 ? item.ipi_valor.toFixed(2) : '-',
          stValor > 0 ? stValor.toFixed(2) : '-',
          item.pis_valor > 0 ? item.pis_valor.toFixed(2) : '-',
          item.cofins_valor > 0 ? item.cofins_valor.toFixed(2) : '-',
          totalItem.toFixed(2),
        ];
      }),
      // Linha de totais no rodapé da tabela
      foot: [[
        '', '', '', '', '', 'TOTAIS:',
        dadosOrcamento.total.toFixed(2),
        dadosOrcamento.total_icms > 0 ? dadosOrcamento.total_icms.toFixed(2) : '-',
        dadosOrcamento.total_ipi > 0 ? dadosOrcamento.total_ipi.toFixed(2) : '-',
        '-',
        dadosOrcamento.total_pis > 0 ? dadosOrcamento.total_pis.toFixed(2) : '-',
        dadosOrcamento.total_cofins > 0 ? dadosOrcamento.total_cofins.toFixed(2) : '-',
        totalComImpostos.toFixed(2),
      ]],
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
      footStyles: {
        fillColor: [230, 240, 250],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 22 },                          // REF
        1: { cellWidth: 'auto' },                      // DESCRIÇÃO (flex)
        2: { cellWidth: 18 },                          // NCM
        3: { cellWidth: 12, halign: 'center' },        // QTD
        4: { cellWidth: 20, halign: 'right' },         // UNIT.
        5: { cellWidth: 14, halign: 'center' },        // DESC%
        6: { cellWidth: 22, halign: 'right' },         // SUBTOTAL
        7: { cellWidth: 18, halign: 'right' },         // ICMS
        8: { cellWidth: 16, halign: 'right' },         // IPI
        9: { cellWidth: 16, halign: 'right' },         // ST
        10: { cellWidth: 16, halign: 'right' },        // PIS
        11: { cellWidth: 18, halign: 'right' },        // COFINS
        12: { cellWidth: 24, halign: 'right' },        // TOTAL
      },
      theme: 'grid',
    });

    const finalY = doc.lastAutoTable?.finalY || startY + 50;

    // Total a pagar — destaque abaixo da tabela
    let totalY = finalY + 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(`TOTAL A PAGAR: R$ ${totalComImpostos.toFixed(2)}`, pageWidth - 14, totalY, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Subtotal: R$ ${dadosOrcamento.total.toFixed(2)}  |  IPI: R$ ${dadosOrcamento.total_ipi.toFixed(2)}`, pageWidth - 14, totalY + 5, { align: 'right' });

    // Condições e observações — lado esquerdo
    if (dadosOrcamento.prazo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Condições:', 14, totalY);
      doc.setFont('helvetica', 'normal');
      doc.text(dadosOrcamento.prazo, 42, totalY);
    }

    if (dadosOrcamento.obs) {
      const obsY = totalY + 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Obs:', 14, obsY);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(dadosOrcamento.obs, pageWidth / 2);
      doc.text(obsLines.slice(0, 2), 26, obsY);
    }

    // Rodapé
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Valores de impostos sujeitos a confirmação na emissão da NF. Orçamento válido por 7 dias. Preços sujeitos a alteração sem aviso prévio.', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 14, pageHeight - 5, { align: 'right' });

    // Salvar PDF em arquivo temporário
    ensureTempDir();
    const pdfId = uuidv4();
    const pdfFileName = `orcamento_${pdfId}.pdf`;
    const pdfFilePath = path.join(PDF_TEMP_DIR, pdfFileName);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    // Nome amigável do arquivo: venda_CODCLI_yyyymmddhhmmssms.pdf
    const now = new Date();
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0')
      + String(now.getMilliseconds()).padStart(3, '0');
    const codcliSafe = String(codcli || 'sem_cliente').replace(/[^a-zA-Z0-9_-]/g, '');
    const nomeArquivo = `venda_${codcliSafe}_${ts}`;

    // Retornar ID e informações do orçamento
    return res.status(200).json({
      success: true,
      pdf_id: pdfId,
      pdf_url: `/api/vendas/orcamento-pdf/${pdfId}`,
      nome_arquivo: nomeArquivo,
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

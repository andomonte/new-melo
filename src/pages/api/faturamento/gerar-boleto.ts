import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat } = req.body;

  if (!codfat) {
    return res.status(400).json({
      error: 'Código da fatura é obrigatório',
    });
  }

  try {
    const client = await getPgPool().connect();

    // Buscar dados da fatura, banco, cliente e parcelas
    const queryFatura = `
      SELECT 
        f.*,
        c.nomefant,
        c.nome,
        c.cpfcgc,
        c.ender,
        c.numero,
        c.bairro,
        c.cidade,
        c.estado,
        c.cep,
        b.nome as banco_nome,
        b.banco as cod_banco
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON c.codcli = f.codcli
      LEFT JOIN db_manaus.dbbancos b ON b.banco = f.cod_banco
      WHERE f.codfat = $1
    `;

    const faturaResult = await client.query(queryFatura, [codfat]);

    if (faturaResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const fatura = faturaResult.rows[0];

    // Buscar parcelas do recebimento
    const queryParcelas = `
      SELECT 
        cod_receb,
        dt_venc,
        valor_pgto,
        nro_doc,
        forma_fat
      FROM db_manaus.dbreceb
      WHERE cod_fat = $1
      ORDER BY dt_venc
    `;

    const parcelasResult = await client.query(queryParcelas, [codfat]);

    // Buscar dados da empresa
    const queryEmpresa = `
      SELECT * FROM dadosempresa LIMIT 1
    `;

    const empresaResult = await client.query(queryEmpresa);

    if (empresaResult.rows.length === 0) {
      client.release();
      return res
        .status(500)
        .json({ error: 'Dados da empresa não encontrados' });
    }

    const dadosEmpresa = empresaResult.rows[0];
    client.release();

    // Verificar se há parcelas
    if (parcelasResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma parcela encontrada para esta fatura',
      });
    }

    console.log('📄 Gerando boleto para fatura:', codfat);
    console.log('📊 Parcelas encontradas:', parcelasResult.rows.length);

    // Preparar dados do sacado (cliente)
    const dadosSacado = {
      nome: fatura.nomefant || fatura.nome,
      cpfcnpj: fatura.cpfcgc,
      endereco: fatura.ender,
      numero: fatura.numero,
      bairro: fatura.bairro,
      cidade: fatura.cidade,
      uf: fatura.estado,
      cep: fatura.cep,
    };

    // Gerar PDF do boleto
    const pdfBuffer = await gerarBoletoPDF(
      dadosEmpresa,
      dadosSacado,
      parcelasResult.rows,
      fatura,
    );

    // Retornar o PDF como base64
    return res.status(200).json({
      success: true,
      boleto: pdfBuffer.toString('base64'),
      parcelas: parcelasResult.rows.length,
    });
  } catch (error) {
    console.error('❌ Erro ao gerar boleto:', error);
    return res.status(500).json({
      error: 'Erro ao gerar boleto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

// Função para gerar o PDF do boleto
async function gerarBoletoPDF(
  dadosEmpresa: any,
  dadosSacado: any,
  parcelas: any[],
  fatura: any,
): Promise<Buffer> {
  const doc = new jsPDF('p', 'pt', 'a4');
  const _pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let y = margin;

  // Processar boletos em pares (2 por página)
  for (let i = 0; i < parcelas.length; i += 2) {
    // Começar nova página para cada par (exceto o primeiro)
    if (i > 0) {
      doc.addPage();
      y = margin;
    }

    // Desenhar primeiro boleto do par
    if (i < parcelas.length) {
      y = drawTicketBlock(
        doc,
        y,
        parcelas[i],
        dadosEmpresa,
        dadosSacado,
        fatura,
        false, // isPreview = false
      );

      // Verificar se há segundo boleto para desenhar
      if (i + 1 < parcelas.length) {
        // Adicionar linha separadora
        y += 5;
        doc.setLineWidth(1);
        doc.line(margin, y, doc.internal.pageSize.width - margin, y);
        y += 10;

        // Desenhar segundo boleto
        y = drawTicketBlock(
          doc,
          y,
          parcelas[i + 1],
          dadosEmpresa,
          dadosSacado,
          fatura,
          false,
        );
      }
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// Função para desenhar um bloco de boleto
function drawTicketBlock(
  doc: jsPDF,
  startY: number,
  parcela: any,
  dadosEmpresa: any,
  dadosSacado: any,
  fatura: any,
  isPreview: boolean,
): number {
  let y = startY;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;

  // Configurações
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Cabeçalho do banco
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Banco: ${fatura.banco_nome || 'Banco'}`, margin, y);
  y += 20;

  // Dados do cedente (empresa)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CEDENTE:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dadosEmpresa.nomecontribuinte || '', margin + 60, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dadosEmpresa.cgc || '', margin + 60, y);
  y += 20;

  // Dados do sacado (cliente)
  doc.setFont('helvetica', 'bold');
  doc.text('SACADO:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dadosSacado.nome || '', margin + 60, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('CPF/CNPJ:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dadosSacado.cpfcnpj || '', margin + 60, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('ENDEREÇO:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${dadosSacado.endereco || ''}, ${dadosSacado.numero || ''}`,
    margin + 70,
    y,
  );
  y += 15;

  doc.text(
    `${dadosSacado.bairro || ''} - ${dadosSacado.cidade || ''}/${
      dadosSacado.uf || ''
    }`,
    margin + 70,
    y,
  );
  y += 20;

  // Dados da parcela
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENTO:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(parcela.nro_doc || '', margin + 90, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('VENCIMENTO:', margin, y);
  doc.setFont('helvetica', 'normal');
  const dataVenc = new Date(parcela.dt_venc).toLocaleDateString('pt-BR');
  doc.text(dataVenc, margin + 90, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('VALOR:', margin, y);
  doc.setFont('helvetica', 'normal');
  const valor = Number(parcela.valor_pgto).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  doc.text(valor, margin + 90, y);
  y += 30;

  // Código de barras (simulado)
  if (!isPreview) {
    // Gerar código de barras fictício para demonstração
    const codigoBarras = '34191234567890123456789012345678901234567890';

    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, codigoBarras, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
      });

      const barcodeImage = canvas.toDataURL('image/png');
      doc.addImage(barcodeImage, 'PNG', margin, y, pageWidth - 2 * margin, 50);
      y += 60;

      // Linha digitável
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(
        '34191.23456 78901.234567 89012.345678 9 01234567890',
        margin,
        y,
      );
      y += 20;
    } catch (error) {
      console.error('Erro ao gerar código de barras:', error);
      doc.text('CÓDIGO DE BARRAS NÃO DISPONÍVEL', margin, y);
      y += 20;
    }
  } else {
    // Modo preview
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('(Código de barras será gerado no boleto final)', margin, y);
    y += 30;
  }

  return y;
}

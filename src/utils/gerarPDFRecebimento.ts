import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { VendaDetalhes } from '@/pages/api/vendas/detalhes/[codvenda]';

export interface DadosEmpresa {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
}

export const gerarPDFRecebimento = async (
  vendaDetalhes: VendaDetalhes,
  dadosEmpresa?: DadosEmpresa,
): Promise<void> => {
  try {
    console.log('Iniciando geração de PDF');
    console.log('Dados da venda:', vendaDetalhes);

    const doc = new jsPDF();

    // Gerar QR Code com o código da venda
    console.log('Gerando QR Code para:', vendaDetalhes.codvenda);
    const qrCodeDataURL = await QRCode.toDataURL(vendaDetalhes.codvenda, {
      width: 100,
      margin: 2,
    });
    console.log('QR Code gerado:', qrCodeDataURL.substring(0, 50) + '...');

    // Configurações iniciais
    const margemEsquerda = 20;
    const margemSuperior = 20;
    let yPosition = margemSuperior;

    // Cabeçalho da empresa (se fornecido)
    if (dadosEmpresa) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(dadosEmpresa.nome, margemEsquerda, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, margemEsquerda, yPosition);
      yPosition += 5;
      doc.text(`${dadosEmpresa.endereco}`, margemEsquerda, yPosition);
      yPosition += 5;
      doc.text(
        `Tel: ${dadosEmpresa.telefone} | Email: ${dadosEmpresa.email}`,
        margemEsquerda,
        yPosition,
      );
      yPosition += 10;

      // Linha separadora
      doc.line(margemEsquerda, yPosition, 190, yPosition);
      yPosition += 10;
    }

    // Título do documento
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PEDIDO PARA SEPARAÇÃO', margemEsquerda, yPosition);
    yPosition += 15;

    // QR Code - posicionar no canto superior direito
    doc.addImage(qrCodeDataURL, 'PNG', 150, margemSuperior, 30, 30);

    // Informações do pedido
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PEDIDO', margemEsquerda, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Box com informações do pedido
    const boxHeight = 35;
    doc.rect(margemEsquerda, yPosition, 170, boxHeight);
    yPosition += 5;

    doc.text(
      `Código da Venda: ${vendaDetalhes.codvenda}`,
      margemEsquerda + 5,
      yPosition,
    );
    yPosition += 5;
    doc.text(
      `Cliente: ${vendaDetalhes.cliente}`,
      margemEsquerda + 5,
      yPosition,
    );
    yPosition += 5;
    doc.text(
      `Vendedor: ${vendaDetalhes.vendedor || 'Não informado'}`,
      margemEsquerda + 5,
      yPosition,
    );
    yPosition += 5;

    const dataHorario = new Date(vendaDetalhes.horario);
    doc.text(
      `Data/Hora: ${dataHorario.toLocaleDateString(
        'pt-BR',
      )} ${dataHorario.toLocaleTimeString('pt-BR')}`,
      margemEsquerda + 5,
      yPosition,
    );
    yPosition += 5;

    // Mapear operação para status legível
    const statusMap: { [key: string]: string } = {
      '1': 'Aguardando Separação',
      '2': 'Em Separação',
      '3': 'Separado',
      '4': 'Finalizado',
    };
    const statusTexto =
      statusMap[vendaDetalhes.operacao] || `Operação ${vendaDetalhes.operacao}`;
    doc.text(`Status: ${statusTexto}`, margemEsquerda + 5, yPosition);
    yPosition += 5;
    if (vendaDetalhes.separador) {
      doc.text(
        `Separador: ${vendaDetalhes.separador}`,
        margemEsquerda + 5,
        yPosition,
      );
    }

    yPosition += 15;

    // Itens do pedido
    if (vendaDetalhes.itens && vendaDetalhes.itens.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ITENS DO PEDIDO', margemEsquerda, yPosition);
      yPosition += 10;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      const colunas = {
        codigo: { x: margemEsquerda, width: 25, label: 'CÓDIGO' },
        descricao: { x: margemEsquerda + 25, width: 80, label: 'DESCRIÇÃO' },
        quantidade: { x: margemEsquerda + 105, width: 20, label: 'QTD' },
        preco: { x: margemEsquerda + 125, width: 25, label: 'PREÇO' },
        subtotal: { x: margemEsquerda + 150, width: 25, label: 'SUBTOTAL' },
      };

      // Desenhar cabeçalho da tabela
      Object.values(colunas).forEach((col) => {
        doc.text(col.label, col.x, yPosition);
      });

      yPosition += 5;
      doc.line(margemEsquerda, yPosition, 190, yPosition);
      yPosition += 5;

      // Itens da tabela
      doc.setFont('helvetica', 'normal');
      let total = 0;

      vendaDetalhes.itens.forEach((item, index) => {
        // Verificar se precisa de nova página
        if (yPosition > 260) {
          doc.addPage();
          yPosition = margemSuperior;
        }

        // Converter strings para números se necessário
        const quantidade =
          typeof item.quantidade === 'string'
            ? parseFloat(item.quantidade)
            : item.quantidade;
        const preco =
          typeof item.preco === 'string' ? parseFloat(item.preco) : item.preco;
        const subtotal =
          typeof item.subtotal === 'string'
            ? parseFloat(item.subtotal)
            : item.subtotal;

        doc.text(item.codprod, colunas.codigo.x, yPosition);

        // Quebrar descrição se muito longa
        const descricaoMaxWidth = colunas.descricao.width - 2;
        const descricaoLinhas = doc.splitTextToSize(
          item.descricao,
          descricaoMaxWidth,
        );
        doc.text(descricaoLinhas[0], colunas.descricao.x, yPosition);

        doc.text(quantidade.toString(), colunas.quantidade.x, yPosition);
        doc.text(`R$ ${preco.toFixed(2)}`, colunas.preco.x, yPosition);
        doc.text(`R$ ${subtotal.toFixed(2)}`, colunas.subtotal.x, yPosition);

        total += subtotal;
        yPosition += 6;

        // Linha separadora a cada 5 itens
        if ((index + 1) % 5 === 0) {
          doc.line(margemEsquerda, yPosition, 190, yPosition);
          yPosition += 2;
        }
      });

      // Total
      yPosition += 5;
      doc.line(margemEsquerda + 125, yPosition, 190, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL: R$ ${total.toFixed(2)}`, colunas.subtotal.x, yPosition);
    }

    // Rodapé com informações do QR Code
    yPosition = 280;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'QR Code contém o código da venda para controle interno',
      margemEsquerda,
      yPosition,
    );
    doc.text(
      `Documento gerado em: ${new Date().toLocaleString('pt-BR')}`,
      margemEsquerda,
      yPosition + 5,
    );

    // Salvar o PDF
    const nomeArquivo = `pedido_${
      vendaDetalhes.codvenda
    }_${new Date().getTime()}.pdf`;
    console.log('Salvando PDF como:', nomeArquivo);
    doc.save(nomeArquivo);
    console.log('PDF salvo com sucesso');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Erro ao gerar PDF do pedido');
  }
};
